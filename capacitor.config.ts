import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: 'com.pumaai.devicemanagement,
  appName: "Player Analysis",
  webDir: "dist",
  // Only use server.url for development with hot reload
  // Remove this for production native builds
  },
  ios: {
    contentInset: "always",
    scheme: "Player Analysis",
    backgroundColor: "#ffffff",
  },
  plugins: {
    CameraPreview: {
      iosDisableAudio: false,
    },
  },
};

export default config;
