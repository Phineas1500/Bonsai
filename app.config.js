module.exports = {
  expo: {
    name: "Bonsai",
    slug: "Bonsai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "com.phineas1500.bonsai",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.phineas1500.Bonsai",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.phineas1500.Bonsai",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "03f3a0c7-d0ac-4a57-8ea2-691c69dee3d9"
      }
    },
    owner: "bonsai-org",
    hooks: {
      preEASBuild: async (config) => {
        if (process.env.GOOGLE_SERVICES_IOS) {
          const fs = require('fs');
          const path = require('path');
          
          // Ensure ios directory exists
          if (!fs.existsSync(path.join(__dirname, 'ios'))) {
            fs.mkdirSync(path.join(__dirname, 'ios'));
          }
          
          // Write the file content
          const fileContents = Buffer.from(process.env.GOOGLE_SERVICES_IOS, 'base64').toString('utf-8');
          fs.writeFileSync(path.join(__dirname, 'ios', 'GoogleService-Info.plist'), fileContents);
          console.log('✅ Created GoogleService-Info.plist from secret');
        }
        return config;
      }
    }
  }
};
