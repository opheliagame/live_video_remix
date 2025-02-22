// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
import "./user_socket.js";

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html";
// Establish Phoenix Socket and LiveView configuration.
import { Socket, Presence } from "phoenix";
import { LiveSocket } from "phoenix_live_view";
import topbar from "topbar";

let csrfToken = document
  .querySelector("meta[name='csrf-token']")
  .getAttribute("content");
let liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: { _csrf_token: csrfToken },
});

// Show progress bar on live navigation and form submits
topbar.config({ barColors: { 0: "#29d" }, shadowColor: "rgba(0, 0, 0, .3)" });
window.addEventListener("phx:page-loading-start", (_info) => topbar.show(300));
window.addEventListener("phx:page-loading-stop", (_info) => topbar.hide());

// connect if there are any LiveViews on the page
liveSocket.connect();

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket;

// Three.js sketch
// example from https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_video_webcam.html
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// dom
let startCaptureButton = document.getElementById("capture-stream-button");
let startStreamButton = document.getElementById("start-stream-button");
let endStreamButton = document.getElementById("end-stream-button");
let startWatchButton = document.getElementById("start-watch-button");
const peerCount = document.getElementById("viewercount");
let streamVideoElement = document.getElementById("streamVideoElement");

// Threejs
let camera, scene, renderer, video;

// socket
let pc = undefined;
let channel = undefined;

startCaptureButton.onclick = () => {
  transformScene();
  makeConnection();
  captureMedia();
  joinChannel();
};

startWatchButton.onclick = () => {
  makeConnection();
  joinChannel();
};

function transformScene() {
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 0.01;

  scene = new THREE.Scene();

  video = document.getElementById("videoElement");

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(16, 9);
  geometry.scale(0.5, 0.5, 0.5);
  const material = new THREE.MeshBasicMaterial({ map: texture });

  const count = 128;
  const radius = 32;

  for (let i = 1, l = count; i <= l; i++) {
    const phi = Math.acos(-1 + (2 * i) / l);
    const theta = Math.sqrt(l * Math.PI) * phi;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.setFromSphericalCoords(radius, phi, theta);
    mesh.lookAt(camera.position);
    scene.add(mesh);
  }

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("canvasOutput"),
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const constraints = {
      video: {
        width: 1280,
        height: 720,
        facingMode: "user",
        audio: true,
        video: true,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async function (stream) {
        // apply the stream to the video element used in the texture

        video.srcObject = stream;
        video.play();
      })
      .catch(function (error) {
        console.error("Unable to access the camera/webcam.", error);
      });
  } else {
    console.error("MediaDevices interface not available.");
  }

  window.addEventListener("resize", onWindowResize);

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    renderer.render(scene, camera);
  }
}

async function makeConnection() {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  pc.ontrack = (event) => {
    if (event.track.kind == "video") {
      console.log("Creating new video element");

      const trackId = event.track.id;
      const videoPlayer = document.createElement("video");
      videoPlayer.srcObject = event.streams[0];
      videoPlayer.autoplay = true;
      videoPlayer.className = "rounded-xl w-full h-full object-cover";

      streamVideoElement.appendChild(videoPlayer);
      // updateVideoGrid();

      event.track.onended = (_) => {
        console.log("Track ended: " + trackId);
        streamVideoElement.removeChild(videoPlayer);
        // updateVideoGrid();
      };
    } else {
      // Audio tracks are associated with the stream (`event.streams[0]`) and require no separate actions
      console.log("New audio track added");
    }
  };
  pc.onicegatheringstatechange = () =>
    console.log("Gathering state change: " + pc.iceGatheringState);

  pc.onconnectionstatechange = () => {
    console.log("Connection state change: " + pc.connectionState);
    if (pc.connectionState == "failed") {
      pc.restartIce();
    }
  };
  pc.onicecandidate = (event) => {
    if (event.candidate == null) {
      console.log("Gathering candidates complete");
      return;
    }

    const candidate = JSON.stringify(event.candidate);
    console.log("Sending ICE candidate: " + candidate);
    channel.push("ice_candidate", { body: candidate });
  };
}

function captureMedia() {
  // get media stream from threejs sketch

  const canvas = document.getElementById("canvasOutput");
  const localStream = canvas.captureStream();
  console.log(
    `capturing stream from canvas: ${localStream.id} ${localStream.active}`
  );
  console.log(`video tracks: ${localStream.getVideoTracks().length}`);
  // add track to webrtc peer connection
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  // if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  //   const constraints = {
  //     video: {
  //       width: 1280,
  //       height: 720,
  //       facingMode: "user",
  //       audio: true,
  //       video: true,
  //     },
  //   };

  //   navigator.mediaDevices
  //     .getUserMedia(constraints)
  //     .then(async function (stream) {

  //       // create and set an offer
  //       // const offer = await pc.createOffer();
  //       // // offer == { type: "offer", sdp: "<SDP here>"}
  //       // await pc.setLocalDescription(offer);
  //       // send offer to elixir app i.e. the other peer
  //       // const json = JSON.stringify(offer);
  //       // userSocket.send_offer(json);
  //     })
  //     .catch(function (error) {
  //       console.error("Unable to access the camera/webcam.", error);
  //     });
  // } else {
  //   console.error("MediaDevices interface not available.");
  // }
}

async function joinChannel() {
  const socket = new Socket("/socket");
  socket.connect();
  channel = socket.channel(`peer:signalling`);

  channel.onError(() => {
    socket.disconnect();
    window.location.reload();
  });
  channel.onClose(() => {
    socket.disconnect();
    window.location.reload();
  });

  channel.on("sdp_offer", async (payload) => {
    const sdpOffer = payload.body;

    console.log("SDP offer received");

    await pc.setRemoteDescription({ type: "offer", sdp: sdpOffer });

    // TODO remove because local tracks already added
    // if (!localTracksAdded) {
    //   console.log("Adding local tracks to peer connection");
    //   localStream.getTracks().forEach((track) => pc.addTrack(track));
    //   localTracksAdded = true;
    // }

    const sdpAnswer = await pc.createAnswer();
    await pc.setLocalDescription(sdpAnswer);

    console.log("SDP offer applied, forwarding SDP answer");
    const answer = pc.localDescription;
    channel.push("sdp_answer", { body: answer.sdp });
  });

  channel.on("ice_candidate", (payload) => {
    const candidate = JSON.parse(payload.body);
    console.log("Received ICE candidate: " + payload.body);
    pc.addIceCandidate(candidate);
  });

  const presence = new Presence(channel);
  presence.onSync(() => {
    peerCount.innerText = presence.list().length;
  });

  channel
    .join()
    .receive("ok", (_) => console.log("Joined channel peer:signalling"))
    .receive("error", (resp) => {
      console.error("Unable to join the room:", resp);
      socket.disconnect();

      // videoPlayerWrapper.removeChild(localVideoPlayer);
      // console.log(`Closing stream with id: ${localStream.id}`);
      // localStream.getTracks().forEach((track) => track.stop());
      // localStream = undefined;

      const errorNode = document.getElementById("join-error-message");
      // errorNode.innerText = "Unable to join the room";
      // if (resp == "peer_limit_reached") {
      //   errorNode.innerText +=
      //     ": Peer limit reached. Try again in a few minutes";
      // }
      // errorNode.classList.remove("hidden");
    });
}
