// Threejs stuff
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.01, 100);
const renderer = new THREE.WebGLRenderer();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; 
//                    GPU %
// BasicShadowMap     1x
// PCFShadowMap       2x    (default)
// PCFSoftShadowMap   4x
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild( renderer.domElement );


// Controls stuff
const controls = new THREE.OrbitControls( camera );
controls.maxAzimuthAngle = Math.PI/3;//hor
controls.minAzimuthAngle = -Math.PI/3;
controls.maxPolarAngle = Math.PI/180 * 160;//vert
controls.minPolarAngle = Math.PI/180 * 20;
controls.update();


// Lights animation stuff
const lights = [];
const lightMoDirs = [1, 1, -1];
const lightMoSpeeds = [0.03, 0.05, 0.04];

(function tick() {
	requestAnimationFrame(tick);
	renderer.render(scene, camera);
  for (const [i, light] of lights.entries()) {
    const lightOldX = light.position.x;
    const lightNewX = light.position.x + lightMoDirs[i] * lightMoSpeeds[i];
    if (lightNewX > 4 || lightNewX < -4) {
      lightMoDirs[i] *= -1;
    }
    light.position.x = lightNewX;
  }
}());


// Events
addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
})


// Main Flow
preload().then(main);



function preload() {
  return new Promise((res, rej) => {
    const imgsrc = elImg.src;
    new THREE.TextureLoader().load(imgsrc, res, undefined, rej);
  });
}



function main(texture) {
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  
  addWall();
  addLights(addFrame(texture));
  
  camera.position.set(-0.3, -0.5, 0.8);
  controls.update();
}



function addWall() {
  const s = 100;
  const color = 0xaa6666;
  
  { // wall
    const geometry = new THREE.PlaneGeometry(s, s, 1, 1);
    const material = new THREE.MeshPhongMaterial({color:color});
    const object = new THREE.Mesh( geometry, material );
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
  }
  
  { // cube "wrapping" the scene, i.e a room
    const geometry = new THREE.BoxGeometry(s, s, s);
    const material = new THREE.MeshPhongMaterial({color:color});
    material.side = THREE.DoubleSide;
    const object = new THREE.Mesh( geometry, material );
    object.castShadow = false;
    object.receiveShadow = true;
    scene.add(object);
  }
};



function addFrame(texture) {
  const frameDepth = 0.01;//z
  const borderWidth = 0.05;//along x (/y)
  const borderDepth = frameDepth * 4;//thicker s.t. it casts shadow on board
  const borderColor = 0x222222;//if fullblack, absorb all light(no way)
  const frameBg = 0xffffff;//bg colo of picture(imagine if its translucent)
  const pictureScale = 0.8;//control amount of frame board to be seen
  const frameBBox = {};//frame bbox, return object

  // frame max dim = 1 in webgl space
  let frameWidth, frameHeight;
  if (texture.image.width > texture.image.height) {
    frameWidth = 1;
    frameHeight = texture.image.height / texture.image.width;
  }
  else {
    frameHeight = 1;
    frameWidth = texture.image.width / texture.image.height;
  }
  
  { // picture plane
    const geometry = new THREE.PlaneGeometry(frameWidth*pictureScale, frameHeight*pictureScale, 1, 1);
    const material = new THREE.MeshPhongMaterial({map:texture});
    const object = new THREE.Mesh( geometry, material );
    object.position.z = frameDepth/2;//overlap with frame borad surface.
    object.castShadow = false;
    object.receiveShadow = true;
    material.polygonOffset = true;//offset=DEPTHSLOPE*<Factor> + <EPSILON>*Units
    material.polygonOffsetUnits = -10;//-ve->get closer;(+ve push farther)
    scene.add(object);
  }
  
  { // frame board (the white shim)
    const geometry = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
    const material = new THREE.MeshPhongMaterial({color:frameBg});
    const object = new THREE.Mesh( geometry, material );
    object.castShadow = false;
    object.receiveShadow = true;
    scene.add(object);  
  }
  
  { // right border
    const geometry = new THREE.BoxGeometry( borderWidth, frameHeight, borderDepth );
    const material = new THREE.MeshPhongMaterial( { color: borderColor } );
    const object = new THREE.Mesh( geometry, material );
    object.position.x = frameWidth/2 + borderWidth/2; // as if css contentbox boxsizing model
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
  }
  
  { // left border
    const geometry = new THREE.BoxGeometry( borderWidth, frameHeight, borderDepth );
    const material = new THREE.MeshPhongMaterial( { color: borderColor } );
    const object = new THREE.Mesh( geometry, material );
    object.position.x = -frameWidth/2 + -borderWidth/2;
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
  }
  
  { // top border
    const geometry = new THREE.BoxGeometry(frameWidth + borderWidth*2, borderWidth, borderDepth );
    const material = new THREE.MeshPhongMaterial( { color: borderColor } );
    const object = new THREE.Mesh( geometry, material );
    object.position.y = frameHeight/2 + borderWidth/2;
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
  }
  
  { // bottom border
    const geometry = new THREE.BoxGeometry(frameWidth + borderWidth*2, borderWidth, borderDepth );
    const material = new THREE.MeshPhongMaterial( { color: borderColor } );
    const object = new THREE.Mesh( geometry, material );
    object.position.y = -frameHeight/2 + -borderWidth/2;
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
  }
  
  frameBBox.width = frameWidth + borderWidth * 2; //include borders
  frameBBox.height = frameHeight + borderWidth * 2;
  return frameBBox;
}



function addLights(frameBBox) {
  const w = frameBBox.width;
  const h = frameBBox.height;
  const shadowMapWidth = 1024;//shadow quality factor
  const shadowMapHeight = 1024;//ditto
  
  { // ambient
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
  }
  
  { // light#1
    const color = 0xffff00;//Y
    const intensity = 0.4;
    const distance = 0;
    const decay = 1;
    const angle = Math.PI/40;
    const penumbra = 1;
    const light = new THREE.SpotLight(color,intensity,distance,angle,penumbra,decay);
    light.position.set(-w*2, h*6, 7);
    light.castShadow = true;
    light.shadow.mapSize.width = shadowMapWidth;
    light.shadow.mapSize.height = shadowMapHeight;
    scene.add( light );
    lights.push(light);
  }
  
  { // light#2
    const color = 0x00ffff;//C
    const intensity = 5;
    const distance = 14;
    const decay = 2;
    const angle = Math.PI/40;
    const penumbra = 1;
    const light = new THREE.SpotLight(color,intensity,distance,angle,penumbra,decay);
    light.position.set(w*3, h*6, 2);
    light.castShadow = true;
    light.shadow.mapSize.width = shadowMapWidth;
    light.shadow.mapSize.height = shadowMapHeight;
    scene.add(light);
    lights.push(light);
  }
  
  { // light#3
    const color = 0xff00ff;//M
    const intensity = 5;
    const distance = 14;
    const decay = 2;
    const angle = Math.PI/40;
    const penumbra = 1;
    const light = new THREE.SpotLight(color,intensity,distance,angle,penumbra,decay);
    light.position.set(0, h*6, 2);
    light.castShadow = true;
    light.shadow.mapSize.width = shadowMapWidth;
    light.shadow.mapSize.height = shadowMapHeight;
    scene.add(light);
    lights.push(light);
  }
}