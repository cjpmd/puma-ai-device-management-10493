import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.cb1a7443dfe74413bc7a813cf6770aa3",
  appName: "Player-Analysis",
  webDir: "dist",
  ios: {
    contentInset: "always",
    scheme: "player-analysis",
    backgroundColor: "#ffffff",
  },
  plugins: {
    CameraPreview: {
      iosDisableAudio: false,
    },
  },
};

export default config;
