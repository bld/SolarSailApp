// Module to integrate solar sail trajectory

var ss2d_data = { beta: 0.01,
		  mu: 1,
		  sia: 0,
		}

function sail2d_ode (t, y, data) {
    let r = y[0], theta = y[1], vr = y[2], vt = y[3];
    let beta = data['beta'], mu = data['mu'], sia = data['sia'];
    let co = Math.cos(sia), si = Math.sin(sia);
    return [
	vr,
	vt / r,
	vt**2 / r + mu * (beta * co**2 * Math.abs(co) - 1) / (r**2),
	mu * beta * co**2 * si / (r**2) - vr * vt / r
    ];
}

function rk4 (f, y0, t0, tf, nt, data) {

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
    let nt = 100;
    let nc = Math.max(angles.length, durations.length);
    let t0i = t0, y0i = y0; // Initial time and state
    let segs = []; // Store trajectory segments
    for (var ic = 0; ic < nc; ic += 1) { // Iterate over number of control segments
	let tfi = t0i + durations[ic]; // Time step size
	// Integrate current segment
	let seg = rk4(sail2d_ode, y0i, t0i, tfi, nt, { beta: beta, mu: mu, sia: angles[ic] });
        segs.push(seg); // Add segment to segments
	y0i = seg[1][seg[1].length - 1]; // New initial state = previous final state
	t0i = tfi; // New initial time = previous final time
    }
    return segs;
}

export { ss2d_data, sail2d_ode, rk4, sail_prop };
