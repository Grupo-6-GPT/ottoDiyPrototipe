# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
![alt text](image.png)
## Otto Bot setup

This app controls an Otto robot over Web Bluetooth using an ESP32 sketch.

### What you need

- An ESP32 board
- 4 servos connected to pins 27, 26, 12 and 14
- Chrome or Edge on desktop
- The app served on localhost or HTTPS, because Web Bluetooth is blocked on plain file access

### Flash the ESP32

1. Open [arduino/otto-ble/otto-ble.ino](/home/jorge/ottobot/arduino/otto-ble/otto-ble.ino) in Arduino IDE.
2. Install the ESP32 board package and the ESP32Servo library.
3. Select the correct ESP32 board and port.
4. Upload the sketch.
5. Open Serial Monitor at 115200 if you want to test commands over USB.

### Connect from the web app

1. Run the Vite app.
2. Open the Connect screen.
3. Click Connect Robot.
4. Pair with the device named Otto-BT-001.
5. Build a choreography and press Play.

### Supported commands

The web app sends these commands to the ESP32: WALK_F, WALK_B, TURN_L, TURN_R, SHAKE, JUMP, MOONWALK, SPIN, TILT_L, TILT_R, STOMP, WIGGLE, BEEP, MELODY, PAUSE, FREEZE, and D for the Smooth Criminal routine.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
