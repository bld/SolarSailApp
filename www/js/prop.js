// Module to integrate solar sail trajectory
// 2D trajectory with polar coordinates
// 4 states to integrate including radius, angle, radial velocity, and tangential velocity

// Data structure to use for integrating sail trajectory segments
var ss2d_data = { beta: 0.01, // Sail lightness number (solar:gravitational acceleration)
		  mu: 1,      // Solar gravitational parameter (mass*G) in AU/TU
		  sia: 0,     // Sun incidence angle of sail (radians)
		}

function sail2d_ode (t, y, data) {
    // Equations of motion of solar sail in 2D with polar coordinates
    //
    // Given time, state (r, theta, v-radial, v-tangential), and
    // object with problem data, return state derivatives for use by
    // ODE solver
    let r = y[0], theta = y[1], vr = y[2], vt = y[3]; // State variables
    let beta = data['beta'], mu = data['mu'], sia = data['sia']; // Problem data
    let co = Math.cos(sia), si = Math.sin(sia); // cos/sin of SIA
    // State derivatives
    return [
	vr, // Radius
	vt / r, // Theta
	vt**2 / r + mu * (beta * co**2 * Math.abs(co) - 1) / (r**2), // v-radial
	mu * beta * co**2 * si / (r**2) - vr * vt / r // v-tangential
    ];
}

function rk4 (f, y0, t0, tf, nt, data) {
    // Runge-Kutta ODE solver of 4th order with fixed stepsize
    //
    // Returns time history of ODE solution given:
    // f: function of ODE to solve
    // y0: initial state
    // t0: initial time
    // tf: final time
    // nt: number of times to solve at
    // data: object with data to pass into ODE function
    //
    // Returns lists [tt, yy] of times and integrated states

    const ny = y0.length;
    
    const h = (tf-t0)/(nt-1);

    let t = t0,	y = y0,	yt = new Array(nt), tt = new Array(nt);
    yt[0] = y0;
    tt[0] = t0;
    
    for (var it = 1; it < nt; it += 1) {

	// Find k variables
	// k1
	let k1 = f(t, y, data);
	// k2
	let iy, yk = new Array(ny);
	for (iy = 0; iy < ny; iy += 1) {
	    yk[iy] = y[iy] + h * k1[iy] / 2;
	}
	let k2 = f(t+h/2, yk, data);
	// k3
	for (iy = 0; iy < ny; iy += 1) {
	    yk[iy] = y[iy] + h * k2[iy] / 2;
	}
	let k3 = f(t+h/2, yk, data);
	// k4
	for (iy = 0; iy < ny; iy += 1) {
	    yk[iy] = y[iy] + h * k3[iy];
	}
	let k4 = f(t+h, yk, data);

	// Find next y
	let yn = new Array(ny);
	for (iy = 0; iy < ny; iy += 1) {
	    yn[iy] = y[iy] + 1.0/6.0 * h * (k1[iy] + 2 * k2[iy] + 2 * k3[iy] + k4[iy]);
	}
	y = yn; // Update y for next iteration
	t += h; // Update time for next iteration
	yt[it] = y; // Push y onto yt
	tt[it] = t; // Push t onto tt
    }

    return [tt, yt];
}

function sail_prop (beta, mu, y0, t0, angles, durations) {
    // Propagate 2D solar sail trajectory in 2D with polar
    // coordinates. Separately integrates segments of constant
    // sun-incidence angle then returns list of time histories (times,
    // state vectors) for each segment.
    //
    // Inputs:
    // beta: lightness number (ratio of solar:gravitational acceleration)
    // mu: gravitational parameter of the sun (mass*G)
    // y0: initial state
    // t0: initial time
    // angles: list of constant sun incidence angles
    // durations: length of time of each constant angles segment
    //
    // Returns:
    // List of [ times, states ] for each constant angle segment
    
    let nt = 100; // Number of times to integrate (TBD: scale according to duration)
    let nc = Math.max(angles.length, durations.length); // Number of segments
    let t0i = t0, y0i = y0; // Initial time and state
    let segs = []; // Store trajectory segments
    // Iterate over number of control segments
    for (var ic = 0; ic < nc; ic += 1) {
	let tfi = t0i + durations[ic]; // Time step size
	// Integrate current segment
	let seg = rk4(sail2d_ode, y0i, t0i, tfi, nt, { beta: beta, mu: mu, sia: angles[ic] });
        segs.push(seg); // Add segment to list of segments
	y0i = seg[1][seg[1].length - 1]; // New initial state = previous final state
	t0i = tfi; // New initial time = previous final time
    }
    // Return list of trajectory segments
    return segs;
}

// Functions and data to make available to the web app
export { ss2d_data, sail2d_ode, rk4, sail_prop };
