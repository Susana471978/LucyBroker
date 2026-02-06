// craco.config.js
const path = require("path");
require("dotenv").config();

/**
 * Configuración limpia para producción y desarrollo
 * (Sin plugins de Emergent / Visual Edits)
 */

module.exports = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },

  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },

    configure: (webpackConfig) => {

      // Reducir carpetas vigiladas (mejor rendimiento)
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/build/**",
          "**/dist/**",
          "**/coverage/**",
          "**/public/**",
        ],
      };

      return webpackConfig;
    },
  },

  devServer: (devServerConfig) => {
    return devServerConfig;
  },
};
