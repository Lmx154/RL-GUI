import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { TelemetryPacket, FlightPhase } from '../types/TelemetryPacket';

// Improved physics-inspired flight simulation for smoother arc trajectory
// Model: brief pre-flight, powered ascent with tilt, ballistic coast to apogee, parachute descent phases.
export const useTelemetrySimulation = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const t0Ref = useRef<number>(0);

  // State of the simulated vehicle in an ENU local frame (meters)
  const stateRef = useRef({
    x: 0, // East
    y: 0, // North
    z: 0, // Up (altitude)
    vx: 0,
    vy: 0,
    vz: 0,
  });

  const flightPhaseRef = useRef<FlightPhase>('pre-flight');
  const apogeeReachedRef = useRef(false);
  // Ideal L3 style flight (approx values, meters). Target apogee ~6100 m (20k ft)
  const mainDeployAlt = 150;    // 500 ft ≈ 152 m
  // (drogueDeployAlt & targetApogee not directly needed in idealized model; removed for lint cleanliness)

  const headingDeg = 35; // fixed launch azimuth
  const headingRad = headingDeg * Math.PI / 180;
  const initialTiltDeg = 5; // slight initial tilt
  const tiltRad = initialTiltDeg * Math.PI / 180;

  // Boost tuned for ~20k ft apogee in simplified model (no detailed drag model)
  // Idealized thrust phase tuned for ~20k ft in simple point-mass model (no Cd integration)
  const BOOST_DURATION = 6.5; // seconds of thrust
  const PEAK_THRUST_ACCEL = 85; // m/s^2 net upward initial (after gravity) quickly tapering

  // Simple drag model parameters for coast/descent shaping
  const COAST_DRAG_K = 0.00018; // quadratic altitude loss shaping (very approximate)
  // (drag factors consolidated into acceleration shaping below)

  const { addTelemetryPacket, setConnected, isSimulating, setSimulating } = useTelemetryStore();
  const landedRef = useRef(false);

  const stepSimulation = useCallback(() => {
    const now = Date.now();
    if (!t0Ref.current) {
      t0Ref.current = now;
      lastTickRef.current = now;
      return;
    }
    const dt = Math.min(0.05, (now - lastTickRef.current) / 1000); // clamp dt for stability
    lastTickRef.current = now;
    const t = (now - t0Ref.current) / 1000; // flight time seconds

    const s = stateRef.current;
    let phase = flightPhaseRef.current;

  // Phase logic timeline based on ideal profile
  if (t < 2) phase = 'pre-flight';
  else if (t >= 2 && t < 2 + BOOST_DURATION) phase = 'powered-ascent';
  else if (!apogeeReachedRef.current) phase = 'burnout'; // ballistic coast until apogee detection
  else if (phase === 'burnout' && apogeeReachedRef.current) phase = 'apogee';

  // After apogee detected (vz <= 0 at high altitude) transition to apogee then drogue shortly after descent starts
  if (phase === 'apogee' && s.vz < -10) phase = 'drogue-deploy';
  // Stay in drogue until reaching main deploy altitude
  if (phase === 'drogue-deploy' && s.z <= mainDeployAlt + 50) phase = 'main-deploy';
  if (phase === 'main-deploy' && s.z <= 5 && Math.abs(s.vz) < 2) phase = 'landed';

    flightPhaseRef.current = phase;

    // Forces/accelerations (simplified)
    let az = -9.81; // gravity baseline
    if (phase === 'powered-ascent') {
      const tau = (t - 2) / BOOST_DURATION; // 0..1
      const thrust = PEAK_THRUST_ACCEL * (0.55 + 0.45 * Math.cos(tau * Math.PI));
      az += thrust;
    } else if (phase === 'burnout') {
      // Ballistic coast with weak drag proportional to velocity squared (simplified)
      az += -COAST_DRAG_K * (s.vz ** 2);
    } else if (phase === 'apogee') {
      // very brief hold, minimal motion; natural gravity acts
      az += 0; // nothing extra
    } else if (phase === 'drogue-deploy') {
      // exponential approach to terminal velocity (~ -35 m/s)
      const targetVz = -35;
      az += (targetVz - s.vz) * 0.5;
    } else if (phase === 'main-deploy') {
      const targetVz = -7; // slow main descent
      az += (targetVz - s.vz) * 0.9;
    } else if (phase === 'landed') {
      s.vz = 0; s.z = 0; az = 0;
    }

    // Horizontal small tilt during boost & coast for arc; after parachute minimal drift
    let ax = 0; let ay = 0;
    if (phase === 'powered-ascent' || phase === 'burnout') {
      const horizontalAccelMag = 1.5 * Math.sin(tiltRad); // small horizontal component
      ax = horizontalAccelMag * Math.cos(headingRad);
      ay = horizontalAccelMag * Math.sin(headingRad);
      // wind drift component
      ax += 0.2; // constant eastward wind
      ay += -0.05; // slight north-south drift
    } else if (phase === 'drogue-deploy' || phase === 'main-deploy') {
      // Wind dominates; approach small terminal horizontal velocity (~5 m/s)
      const targetVx = 5; const targetVy = -2;
      ax += (targetVx - s.vx) * 0.3;
      ay += (targetVy - s.vy) * 0.3;
    }

    // Integrate velocities
    s.vx += ax * dt;
    s.vy += ay * dt;
    s.vz += az * dt;

    // Integrate positions
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    if (s.z < 0) { s.z = 0; s.vz = 0; }

    // Detect apogee
    if (!apogeeReachedRef.current && s.vz <= 0 && phase === 'burnout') {
      apogeeReachedRef.current = true;
      flightPhaseRef.current = 'apogee';
    }

    // Convert local ENU (meters) to lat/lon around base lat/lon
    const baseLat = 35.0844 * Math.PI / 180;
    const baseLon = -106.6504 * Math.PI / 180;
    const R = 6371000;
    const lat = baseLat + (s.y / R);
    const lon = baseLon + (s.x / (R * Math.cos(baseLat)));
    const altitude = s.z;

    // Heading from horizontal velocity
    const heading = (Math.atan2(s.vx, s.vy) * 180 / Math.PI + 360) % 360; // degrees (north referenced)

    // IMU synthetic measurements
    const imuAccelX = ax + (Math.random() - 0.5) * 0.2;
    const imuAccelY = ay + (Math.random() - 0.5) * 0.2;
    const imuAccelZ = az + 9.81 + (Math.random() - 0.5) * 0.4; // include gravity for raw accel

    const packet: TelemetryPacket = {
      timestamp: now,
      imu: {
        accel: { x: imuAccelX, y: imuAccelY, z: imuAccelZ },
        gyro: { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 },
        mag: { x: 0.25 + (Math.random()-0.5)*0.02, y: 0.05 + (Math.random()-0.5)*0.02, z: 0.9 + (Math.random()-0.5)*0.02 },
      },
      gps: {
        lat: lat * 180/Math.PI,
        lon: lon * 180/Math.PI,
        alt: altitude + (Math.random()-0.5)*2,
        heading,
      },
      baro: {
        pressure: 1013.25 * Math.exp(-altitude / 8500),
        altitude: altitude + (Math.random()-0.5)*1.5,
      },
      velocity: { x: s.vx, y: s.vy, z: s.vz },
      phase: flightPhaseRef.current,
      battery: Math.max(3.2, 4.15 - t * 0.002),
      rssi: -40 - t * 0.05 + (Math.random()-0.5)*3,
    };

    if (flightPhaseRef.current === 'landed') {
      if (!landedRef.current) {
        addTelemetryPacket(packet); // push the first landed frame
        landedRef.current = true;
        // stop simulation next tick
        setTimeout(() => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setSimulating(false);
          setConnected(false);
        }, 100);
      }
      return; // do not add more landed packets
    }
    addTelemetryPacket(packet);
  }, [addTelemetryPacket]);

  // (already grabbed store values above)

  const startSimulation = useCallback(() => {
    if (intervalRef.current) return;
    // reset state
    stateRef.current = { x:0,y:0,z:0,vx:0,vy:0,vz:0 };
    flightPhaseRef.current = 'pre-flight';
    apogeeReachedRef.current = false;
    t0Ref.current = 0; lastTickRef.current = 0;
    setConnected(true);
    intervalRef.current = setInterval(stepSimulation, 50); // 20Hz
  }, [setConnected, stepSimulation]);

  const stopSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    if (isSimulating) startSimulation(); else stopSimulation();
    return () => { stopSimulation(); };
  }, [isSimulating, startSimulation, stopSimulation]);

  return { startSimulation, stopSimulation };
};