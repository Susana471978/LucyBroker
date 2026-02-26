import React from "react";
import videoBg from "../../assets/video-fondo-ecs.mp4";
const LandingVideoBackground = () => {
    return (
        <div style={containerStyle}>
            <video
                autoPlay
                loop
                muted
                playsInline
                style={videoStyle}
            >
                <source src={videoBg} type="video/mp4" />
            </video>

            <div style={overlayStyle} />
        </div>
    );
};

const containerStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    zIndex: 0,
    pointerEvents: "none"
};

const videoStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "blur(22px) brightness(0.40) contrast(0.95)",
    transform: "scale(1.1)"
};

const overlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",

};

export default LandingVideoBackground;