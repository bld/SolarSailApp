import * as THREE from './three.module.js';

import { ss2d_data, sail2d_ode, rk4, sail_prop } from './prop.js';

const deg2rad = Math.PI/180.0;

function toggleDiv(divId) {
    var div = document.getElementById(divId);
    if (div.style.display == 'block') {
        div.style.display = 'none';
    }
    else {
        div.style.display = 'block';
    }
}

function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

/* const colormap = [ 0x750787ff, 0x004dffff, 0x008026ff, 0xffed00ff, 0xff8c00ff, 0xe40303ff, 0xffafc8ff, 0x74d7eeff, 0x613915ff ]; */
const colormap = [ 0x750787, 0x004dff, 0x008026, 0xffed00, 0xff8c00, 0xe40303, 0xffffff, 0xffafc8, 0x74d7ee, 0x613915 ];


/**
 * Generate point cloud of stars to render in scene
 * @param {Number}        nstars Number of star points
 * @param {Number}        r1     Inner radius of point cloud
 * @param {Number}        r2     Outer radius of point cloud
 * @return {THREE.Points}        Stars point cloud geometry
 */
function stars(nstars = 10000, r1 = 500, r2 = r1 * 2) {
    // const nstars = 10000;
    const g = new THREE.BufferGeometry();
    const m = new THREE.PointsMaterial({size: 1});
    // const r1 = 500;
    // const r2 = 1000;
    const v = [];
    for (var i = 0; i < nstars; i += 1) {
        const el = Math.acos(1 - Math.random() * 2); // Correct from uniform distribution
        const r = Math.random() * (r2 - r1) + r1; // Spread from r1 to r2
        const az = Math.random() * 2 * Math.PI; // Azimuth from 0 to 2pi radians
        const x = r * Math.cos(az) * Math.sin(el);
        const y = r * Math.sin(az) * Math.sin(el);
        const z = r * Math.cos(el);
        v.push(x, y, z);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeBoundingSphere();
    return new THREE.Points(g, m);
}

/**
 * Generate a sun object to render in scene
 * @param  {Number}     r        Radius of sun (in AU)
 * @param  {Number}     segments Number of segments in sphere
 * @return {THEEE.Mesh}          Sun mesh geometry
 */
function sun (r = 0.00465, segments = 32, color = 0xf9ffd9) {
    var g = new THREE.SphereGeometry(0.00465, 32, 32);
    var m = new THREE.MeshBasicMaterial({ color : color });
    return new THREE.Mesh(g, m);
}

/**
 * Generate a circular line object representing a planet's orbit with
 * the radius equal to the semi-major axis
 * @param  {Number}     r   Radius of the orbit (semi-major axis) in AU
 * @param  {Number}     col Color hexcode of orbit to draw
 * @return {THREE.Line}     Orbit line geometry
 */
function planet(r, col) {
    const nsegs = 360;
    const m = new THREE.LineBasicMaterial({color: col});
    const g = new THREE.BufferGeometry();
    const v = [];
    for (var i = 0; i <= nsegs; i += 1) {
        const theta = (i / nsegs) * Math.PI * 2;
        v.push(r * Math.cos(theta), r * Math.sin(theta), 0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeBoundingSphere();
    return new THREE.Line(g, m);
}

var planets = { mercury : new planet(0.387, colormap[0]),
                venus : new planet(0.723, colormap[1]),
                earth : new planet(1, colormap[2]),
                mars : new planet(1.5, colormap[3]),
                ceres : new planet(2.77, colormap[4]),
                jupiter : new planet(5.2, colormap[5]),
                saturn : new planet(9.58, colormap[6]),
                uranus : new planet(19.22, colormap[7]),
                neptune : new planet(30.07, colormap[8]),
                pluto : new planet(39.48, colormap[9]),
              }

/**
 * Draw sail trajectory segment
 * @param  {Array}      seg Sail trajectory segment as [time, [r, theta, v_r, v_t]]
 * @param  {Number}     col Hex color of trajectory segment
 * @return {THREE.Line}     Trajectory segment line geometry
 */
function drawseg(seg, col) {
    const g = new THREE.BufferGeometry();
    const m = new THREE.LineBasicMaterial({color: col});
    const v = [];
    let tt, yt;
    [tt, yt] = seg;
    for (let it = 0; it < tt.length; it += 1) {
        let y = yt[it];
        let [r, theta] = y;
        v.push(r*Math.cos(theta), r*Math.sin(theta), 0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeBoundingSphere();
    return new THREE.Line(g, m);
}

/**
 * Top level function to render sail trajectory in the solar system
 * @return {Object} Solar sail trajectory app object
 */
function sstraj() {
    // Dictionary to store app data
    const app = {};
    // Scene
    app.scene = new THREE.Scene();
    // Origin of scene
    app.origin = new THREE.Vector3(0, 0, 0);
    // Renderer
    app.renderer = window.WebGLRenderingContext ? new THREE.WebGLRenderer({ antialias : true }) : new THREE.CanvasRenderer();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
    // Document element
    app.plotDiv = document.getElementById('plot');
    app.plotDiv.appendChild(app.renderer.domElement);
    // Camera
    app.fov = 75;
    app.camera = new THREE.PerspectiveCamera(app.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    app.camera.position.set(0, 0, 10);
    app.camera.lookAt(app.origin);
    app.scene.add(app.camera);
    // Simulated sunlight
    app.light = new THREE.PointLight(0xffffff, 1, 100);
    app.light.position.set(0, 0, 0);
    app.scene.add(app.light);
    // Ambient light to show objects
    app.alight = new THREE.AmbientLight(0xffffff, 0.1);
    app.scene.add(app.alight);
    // Sun
    app.sun = sun();
    app.scene.add(app.sun);
    // Stars
    app.stars = stars();
    app.scene.add(app.stars);
    // Planet orbits
    app.planets = planets;
    for (var pl in app.planets) {
        app.scene.add(app.planets[pl]);
    }
    // Sail data
    app.sail = {
        // Default sail data
        beta: 0.1,
        mu: 1,
        y0: [1, 0, 0, 1],
        t0: 0,
        angles: [0.6155, -0.6155, 1.5707963],
        durations: [5, 2, 1],
        trajdata: [],
        segments: [],
        colors: colormap,
    }

    // Render function
    app.render = function () {
        if (resizeRendererToDisplaySize(app.renderer)) {
            const canvas = app.renderer.domElement;
            app.camera.aspect = canvas.clientWidth / canvas.clientHeight;
            app.camera.updateProjectionMatrix();
        }
        app.renderer.render(app.scene, app.camera);
    }
    // Window resize function
    app.onWindowResize = function () {
        app.camera.aspect = window.innerWidth / window.innerHeight;
        app.camera.updateProjectionMatrix();
        app.renderer.setSize(window.innerWidth, window.innerHeight);
        app.camera.lookAt(app.origin);
        return app.renderer.render(app.scene, app.camera);
    }
    // Init function
    app.init = function () {
        return window.addEventListener('resize', app.onWindowResize, false);
    }
    // Return app
    return app;
}

/**
 * Update trajectory inputs, propagate, and drawing geometry
 */
function updateTrajectory(app, document) {
    // Clear old geometry segments from scene
    app.sail.segments.forEach((segment) => app.scene.remove(segment));
    // Remove trajectory segments and controls
    app.sail.segments = [];
    app.sail.angles = [];
    app.sail.durations = [];
    // Read data from input fields
    app.sail.beta = document.getElementsByName('lightness')[0].valueAsNumber;
    document.getElementsByName('angles[]').forEach((anglestring) => app.sail.angles.push(anglestring.valueAsNumber * deg2rad));
    document.getElementsByName('durations[]').forEach((durstring) => app.sail.durations.push(durstring.valueAsNumber));
    // Propagate trajectory
    app.sail.trajdata = sail_prop(app.sail['beta'], app.sail['mu'], app.sail['y0'], app.sail['t0'], app.sail['angles'], app.sail['durations']);
    // Generate sail trajectory geometry, find max radius
    app.rmax = 0;
    app.sail.trajdata.forEach((trajseg, idx) => {
        app.sail.segments.push(drawseg(trajseg, app.sail.colors[idx]));
        let [tt, yt] = trajseg;
        yt.forEach((y) => {
            let [r, th] = y;
            app.rmax = Math.max(app.rmax, r);
        });
    });
    // Add sail geometry segments to scene for rendering
    app.sail.segments.forEach((segment) => app.scene.add(segment));
    // Update camera to fit max trajectory radius
    app.rcam = 1.1 * (app.rmax / Math.tan((app.fov * (Math.PI / 180)) / 2));
    app.camera.position.set(0, 0, app.rcam);
}

/**
 * Add new control
 */
function addControl (el) {
    // Access data
    let button = el.target;
    let row = button.parentElement.parentElement;
    let rowIndex = row.rowIndex;
    let tab = row.parentElement;
    let newrow = tab.insertRow(rowIndex+1);
    // Angles
    let ang = newrow.insertCell(0);
    let angtd = document.createElement('input');
    angtd.id = 'angle';
    angtd.type = 'number';
    angtd.name = 'angles[]';
    angtd.min = '-90';
    angtd.max = '90';
    angtd.step = '5';
    angtd.value = '0';
    ang.appendChild(angtd);
    // Durations
    let dur = newrow.insertCell(1);
    let durtd = document.createElement('input');
    durtd.id = 'duration';
    durtd.type = 'number';
    durtd.name = 'durations[]';
    durtd.min = '0';
    durtd.max = '10';
    durtd.step = '0.1';
    durtd.value = '1';
    dur.appendChild(durtd);
    // Add add button
    let add = newrow.insertCell(2);
    let addtd = document.createElement('button');
    addtd.appendChild(document.createTextNode('+'));
    addtd.name = 'addctrl[]';
    add.appendChild(addtd);
    // Add delete button if there are more than one rows
    let del = newrow.insertCell(3);
    let deltd = document.createElement('button');
    deltd.appendChild(document.createTextNode('-'));
    deltd.name = 'delctrl[]';
    del.appendChild(deltd);
    // Update trajectory and input and button events
    updateTrajectory(app, document);
    updateInputEvents();
    // Re-render after adding control
    app.render();
}

/**
 * Delete control
 */
function delControl(el) {
    let button = el.target;
    let row = button.parentElement.parentElement;
    let rowIndex = row.rowIndex;
    let tab = row.parentElement;
    if (tab.rows.length > 3) {
        tab.deleteRow(rowIndex);
    }
    // Update trajectory and input and button events
    updateTrajectory(app, document);
    updateInputEvents();
    // Re-render after deleting control
    app.render();
}

// Create sail trajectory plot, initialize, update trajectory the first time, and plot
const app = sstraj();
app.init();
updateTrajectory(app, document);
app.render();

// Enable toggling visibility of the controls
document.getElementById('button').addEventListener('click', function () { toggleDiv('controls'); });

// Update trajectory when document ready
document.onreadystatechange = () => {
    if (document.readyState === 'complete') {
        updateTrajectory(app, document);
        updateInputEvents();
    }
};

// Input events
function updateInputEvents() {
    // Update trajectory and re-render on control input
    document.querySelectorAll('input').forEach((element) => element.addEventListener('input', function(e) { updateTrajectory(app, document); app.render(); }));
    // Update adding trajectory control
    document.getElementsByName('addctrl[]').forEach((button) => button.onclick = addControl);
    // Update deleting trajectory control
    document.getElementsByName('delctrl[]').forEach((button) => button.onclick = delControl);
}
