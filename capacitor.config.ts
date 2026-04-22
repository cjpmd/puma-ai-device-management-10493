import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pumaai.devicemanagement",
  appName: "Player Analysis",
  webDir: "dist",
  ios: {
    contentInset: "always",
    scheme: "playeranalysis",
    backgroundColor: "#ffffff",
  },
  plugins: {
    CameraPreview: {
      iosDisableAudio: false,
    },
  },
};

export default config;
