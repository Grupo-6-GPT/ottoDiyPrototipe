  // =============================================================
  //  Otto DIY v1 – ESP32 BLE  |  MOVIMIENTOS EXTENDIDOS v3
  //  Sistema de neutros calibrados (igual que tu código base)
  //
  //  Servo order:
  //    pieIzq   = tobillo izquierdo   pin PIN_PIE_IZQ
  //    pieDer   = tobillo derecho     pin PIN_PIE_DER
  //    musloIzq = muslo izquierdo     pin PIN_MUSLO_IZQ
  //    musloDer = muslo derecho       pin PIN_MUSLO_DER
  //
  //  TODOS los ángulos son OFFSETS sobre el neutro calibrado.
  //  Ajusta los 4 NEUTRO_* para centrar tu Otto específico.
  //
  //  COMANDOS BLE / Serial (terminar con \n)
  //  ─────────────────────────────────────────────────────────────
  //  LOCOMOCIÓN:
  //    WALK_F[:vel]     caminar adelante   (vel default 220 ms)
  //    WALK_B[:vel]     caminar atrás
  //    WALK_F_FAST      WALK_F:120
  //    WALK_F_SLOW      WALK_F:400
  //    WALK_B_FAST      WALK_B:120
  //    WALK_B_SLOW      WALK_B:400
  //    TURN_L[:vel]     girar izq
  //    TURN_R[:vel]     girar der
  //    TURN_L_FAST / TURN_R_FAST
  //    JUMP
  //    MOONWALK[:vel]   moonwalk adelante
  //    MOONWALK_B[:vel] moonwalk atrás
  //    SPIN             giro rápido completo
  //    SPIN_L / SPIN_R  giro a un lado
  //    MARCH_F          marcha militar adelante
  //    MARCH_B          marcha atrás
  //    SNEAK_F          pasos sigilosos adelante
  //    SNEAK_B          pasos sigilosos atrás
  //    STRUT_F          caminar con estilo adelante
  //    STRUT_B          caminar con estilo atrás
  //
  //  PASOS LATERALES Y BALANCE:
  //    SIDE_STEP_L      paso lateral izquierda
  //    SIDE_STEP_R      paso lateral derecha
  //    SIDE_STEP_FAST   pasos laterales alternados rápidos
  //    LEAN_L / LEAN_R  inclinarse a un lado
  //    LEAN_F / LEAN_B  inclinarse adelante / atrás
  //    BALANCE          balanceo suave lado a lado
  //    ROCK_LR          rockeo brusco izq-der
  //    ROCK_LR_FAST     rockeo rápido
  //    ROCK_FB          rockeo adelante-atrás
  //    WIDE_STAND       postura abierta
  //    PIGEON_L / PIGEON_R  postura pigeon
  //
  //  PATADAS Y PISOTONES:
  //    KICK_L / KICK_R  patada lateral
  //    STOMP            pisotón alternado
  //    STOMP_L / STOMP_R  pisotón con pie específico
  //    STOMP_ALTERNATE  pisotones alternados x4
  //    HI_FIVE_L / HI_FIVE_R  levantar pie (chocar mano)
  //
  //  AGACHARSE:
  //    SQUAT            agacharse y levantarse
  //    SQUAT_PULSE      pulsaciones de squat
  //    CROUCH           posición agachada y volver
  //
  //  BAILE – OSCILADORES:
  //    SHAKE            vibración lateral rápida
  //    SHIMMY[:vel]     shimmy de cadera
  //    SHIMMY_SLOW      shimmy lento
  //    WIGGLE           wiggle suave
  //    TILT_L / TILT_R  inclinar y volver
  //    SWING[:vel]      balanceo de cadera
  //    SWING_BIG        swing exagerado
  //    UPDOWN           subir y bajar
  //    UPDOWN_BIG       subir y bajar exagerado
  //    BOUNCE           rebote rítmico
  //    BOUNCE_BIG       rebote exagerado
  //    BODY_ROLL        ola corporal
  //    BODY_ROLL_FAST   ola rápida
  //    WAVE_L / WAVE_R  ola de cadera a un lado
  //    WAVE_FULL        ola completa
  //    PULSE_LR         pulso lateral sincronizado
  //    JITTER           vibración rápida
  //    JITTER_SMALL     vibración pequeña
  //    DISCO_L / DISCO_R  paso disco
  //    ROBOT_STEP       pasos robóticos
  //    ROBOT_STEP_FAST  pasos robóticos rápidos
  //    ASCENDING        giro ascendente
  //    TIPTOE           puntillas swing
  //    ELECTRIC_SLIDE   secuencia electric slide
  //
  //  EXPRESIONES:
  //    SCARED           asustarse
  //    HAPPY_DANCE      baile feliz
  //    SAD_WALK         caminar triste
  //    DIZZY            mareado
  //    TIRED            cansado
  //    SNEEZE           estornudo
  //
  //  UTILIDADES:
  //    HOME / NEUTRO    posición neutra
  //    FREEZE[:ms]      congelar
  //    PAUSE[:ms]       esperar
  //    BEEP             pitido
  //    MELODY           melodía
  //
  //  COMBOS:
  //    COMBO_SALSA
  //    COMBO_ROBOT
  //    COMBO_WAVE
  //    COMBO_REGGAETON
  //
  //  COREOGRAFÍAS:
  //    SMOOTH / SMOOTH_CRIMINAL
  //    SHAKE_IT          (shake + shimmy + wiggle)
  //    DEMO              todos los movimientos
  //
  //  SECUENCIAS:
  //    SEQ:CMD1,CMD2,CMD3,...
  // =============================================================
  
  #include <BLEDevice.h>
  #include <BLEServer.h>
  #include <BLEUtils.h>
  #include <BLE2902.h>
  #include <ESP32Servo.h>
  #include "soc/soc.h"
  #include "soc/rtc_cntl_reg.h"
  
  // ── BLE UUIDs ──────────────────────────────────────────────
  #define OTTO_UART_SERVICE_UUID    "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
  #define OTTO_UART_RX_UUID         "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
  #define OTTO_BATTERY_SERVICE_UUID "180F"
  #define OTTO_BATTERY_LEVEL_UUID   "2A19"
  
  // ── Pines ──────────────────────────────────────────────────
  #define PIN_PIE_IZQ   27
  #define PIN_PIE_DER   26
  #define PIN_MUSLO_IZQ 12
  #define PIN_MUSLO_DER 14
  
  #define USE_BUZZER 0
  #define PIN_BUZZER 25
  
  // ── Neutros calibrados ─────────────────────────────────────
  //  Ajusta estos 4 valores para que tu Otto quede recto en neutro.
  //  Cada NEUTRO_* es el ángulo absoluto que va a ese servo en reposo.
  #define NEUTRO_PIE_IZQ    120
  #define NEUTRO_PIE_DER     65
  #define NEUTRO_MUSLO_IZQ  105
  #define NEUTRO_MUSLO_DER  105
  
  // ── Servos ─────────────────────────────────────────────────
  Servo pieIzq, pieDer, musloIzq, musloDer;
  
  // ── BLE ────────────────────────────────────────────────────
  BLEServer *bleServer    = nullptr;
  bool deviceConnected    = false;
  String seqBuffer        = "";
  
  void runCommand(String command);  // forward declaration
  
  // =============================================================
  //  MOTOR BASE
  //  mover(oi, od, mi, md, ms)
  //  Todos los parámetros son OFFSETS sobre el neutro calibrado.
  //  oi = offset pieIzq    od = offset pieDer
  //  mi = offset musloIzq  md = offset musloDer
  //  ms = tiempo en milisegundos
  // =============================================================
  void mover(int oi, int od, int mi, int md, int ms) {
    pieIzq.write  (constrain(NEUTRO_PIE_IZQ   + oi, 0, 180));
    pieDer.write  (constrain(NEUTRO_PIE_DER   + od, 0, 180));
    musloIzq.write(constrain(NEUTRO_MUSLO_IZQ + mi, 0, 180));
    musloDer.write(constrain(NEUTRO_MUSLO_DER + md, 0, 180));
    delay(ms);
  }
  
  // Posición neutra calibrada
  void neutro(int ms = 400) {
    mover(0, 0, 0, 0, ms);
  }
  
  void beepTone(int freq, int ms) {
  #if USE_BUZZER
    tone(PIN_BUZZER, freq, ms); delay(ms + 20); noTone(PIN_BUZZER);
  #else
    delay(ms);
  #endif
  }
  
  // =============================================================
  //  ══════════════════════════════════════════════════════════
  //  LOCOMOCIÓN
  //  ══════════════════════════════════════════════════════════
  // =============================================================
  
  // ─── caminar(pasos, vel) ─────────────────────────────────────
  //  Marcha normal hacia adelante.
  //  Ciclo de 4 tiempos: pie izq levanta + muslo avanza, neutro,
  //  pie der levanta + muslo avanza, neutro.
  void caminar(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover( 15,   0,  20,   0, vel);
      mover(  0,   0,   0,   0, vel);
      mover(  0, -15,   0,  20, vel);
      mover(  0,   0,   0,   0, vel);
    }
    neutro();
  }
  
  // ─── caminarAtras(pasos, vel) ────────────────────────────────
  void caminarAtras(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover( 20,   0, -15,   0, vel);
      mover(  0,   0,   0,   0, vel);
      mover(  0, -20,   0,  15, vel);
      mover(  0,   0,   0,   0, vel);
    }
    neutro();
  }
  
  // ─── girar(pasos, dir, vel) ──────────────────────────────────
  //  dir=+1 izq, dir=-1 der
  void girar(int pasos, int dir, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover(dir * 20,         0,  dir * 15,          0, vel);
      mover(         0, dir * 20,           0, dir * 15, vel);
    }
    neutro();
  }
  
  // ─── moonwalk(pasos, vel, dir) ───────────────────────────────
  //  dir=+1 adelante visual, dir=-1 atrás visual
  void moonwalk(int pasos, int vel, int dir) {
    for (int i = 0; i < pasos; i++) {
      mover( dir*20,    0, -dir*15,      0, vel);
      mover(       0,   0,        0,     0, vel);
      mover(       0, -dir*20,    0, dir*15, vel);
      mover(       0,   0,        0,     0, vel);
    }
    neutro();
  }
  
  // ─── spinMove(vel) ───────────────────────────────────────────
  //  Giro rápido completo (4 pasos girando siempre a la derecha).
  void spinMove(int vel) {
    for (int i = 0; i < 4; i++) {
      mover( 20,   0,  15, -10, vel);
      mover(  0,  20, -10,  15, vel);
    }
    neutro();
  }
  
  // ─── spinDir(dir, pasos, vel) ────────────────────────────────
  //  Giro en una dirección (dir=+1 izq, dir=-1 der).
  void spinDir(int dir, int pasos, int vel) {
    girar(pasos, dir, vel);
  }
  
  // ─── marchF / marchB ─────────────────────────────────────────
  //  Marcha militar: pasos cortos y marcados con pausa.
  void marchF(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover( 10,   0,  25,   0, vel);
      mover(  0,   0,   0,   0, vel/2);
      mover(  0, -10,   0,  25, vel);
      mover(  0,   0,   0,   0, vel/2);
    }
    neutro();
  }
  
  void marchB(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover( 10,   0, -25,   0, vel);
      mover(  0,   0,   0,   0, vel/2);
      mover(  0, -10,   0, -25, vel);
      mover(  0,   0,   0,   0, vel/2);
    }
    neutro();
  }
  
  // ─── sneakF / sneakB ─────────────────────────────────────────
  //  Caminar sigiloso: amplitud reducida, muy suave.
  void sneakF(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover(  8,   0,  12,   0, vel);
      mover(  0,   0,   0,   0, vel);
      mover(  0,  -8,   0,  12, vel);
      mover(  0,   0,   0,   0, vel);
    }
    neutro();
  }
  
  void sneakB(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover(  8,   0, -12,   0, vel);
      mover(  0,   0,   0,   0, vel);
      mover(  0,  -8,   0, -12, vel);
      mover(  0,   0,   0,   0, vel);
    }
    neutro();
  }
  
  // ─── strutF / strutB ─────────────────────────────────────────
  //  Caminar con estilo: levanta más los pies y marca el paso.
  void strutF(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover( 20,   0,  30,   0, vel);
      mover(  0,   0,   0,   0, vel/2);
      mover(  0, -20,   0,  30, vel);
      mover(  0,   0,   0,   0, vel/2);
    }
    neutro();
  }
  
  void strutB(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover( 20,   0, -30,   0, vel);
      mover(  0,   0,   0,   0, vel/2);
      mover(  0, -20,   0, -30, vel);
      mover(  0,   0,   0,   0, vel/2);
    }
    neutro();
  }
  
  // =============================================================
  //  PASOS LATERALES Y BALANCE
  // =============================================================
  
  // ─── sideStep(dir, pasos, vel) ───────────────────────────────
  //  Paso lateral: dir=+1 izq, dir=-1 der
  void sideStep(int dir, int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover(dir*20,  dir*10, -dir*12,  dir*5, vel);
      mover(      0,       0,       0,      0, vel/2);
      mover(dir*10,  dir*20,  dir*5, -dir*12, vel);
      mover(      0,       0,       0,      0, vel/2);
    }
    neutro();
  }
  
  // ─── sideStepFast(pasos, vel) ────────────────────────────────
  //  Pasos laterales alternados (electric slide basis).
  void sideStepFast(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      sideStep(+1, 1, vel);
      sideStep(-1, 1, vel);
    }
  }
  
  // ─── lean(lado, angulo, ms) ──────────────────────────────────
  //  Inclinar muslos hacia un lado. lado=+1 izq, lado=-1 der.
  void lean(int lado, int angulo, int ms) {
    musloIzq.write(constrain(NEUTRO_MUSLO_IZQ + lado * angulo, 0, 180));
    musloDer.write(constrain(NEUTRO_MUSLO_DER + lado * angulo, 0, 180));
    delay(ms);
  }
  
  // ─── leanSide(dir, vel) ──────────────────────────────────────
  //  Inclinarse a un lado y volver. dir=+1 izq, dir=-1 der.
  void leanSide(int dir, int vel) {
    mover(dir*25, dir*8,  dir*15, dir*8, vel/2);
    delay(vel/4);
    neutro(vel/2);
  }
  
  // ─── leanFB(dir, vel) ────────────────────────────────────────
  //  Inclinarse adelante/atrás. dir=+1 adelante, dir=-1 atrás.
  void leanFB(int dir, int vel) {
    mover(0, 0, dir*20, -dir*20, vel/2);
    delay(vel/4);
    neutro(vel/2);
  }
  
  // ─── balance(reps, vel) ──────────────────────────────────────
  //  Balanceo suave de lado a lado.
  void balance(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover( 18,  6,  8,  4, vel);
      mover( -6,-18, -4, -8, vel);
    }
    neutro();
  }
  
  // ─── rockLR(reps, vel) ───────────────────────────────────────
  //  Rockeo brusco izq-der.
  void rockLR(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover( 25, -10,  10, -5, vel/4);
      mover(-10,  25,  -5, 10, vel/4);
    }
    neutro(vel/4);
  }
  
  // ─── rockFB(reps, vel) ───────────────────────────────────────
  //  Rockeo adelante-atrás.
  void rockFB(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover(0, 0,  18, -18, vel/3);
      mover(0, 0, -18,  18, vel/3);
    }
    neutro(vel/3);
  }
  
  // ─── wideStand(vel) ──────────────────────────────────────────
  //  Postura abierta: pies girados hacia afuera.
  void wideStand(int vel) {
    mover(25, -25, 0, 0, vel/2);
    delay(vel/4);
    neutro(vel/2);
  }
  
  // ─── pigeonPose(dir, vel) ────────────────────────────────────
  //  Postura pigeon: un pie girado adentro. dir=+1 izq, dir=-1 der.
  void pigeonPose(int dir, int vel) {
    if (dir > 0) mover(-22, 0, 14, 0, vel/2);
    else         mover(0, 22, 0, -14, vel/2);
    delay(vel/4);
    neutro(vel/2);
  }
  
  // =============================================================
  //  PATADAS Y PISOTONES
  // =============================================================
  
  // ─── kickLateral(lado, vel) ──────────────────────────────────
  //  Patada lateral. lado=+1 izq, lado=-1 der.
  void kickLateral(int lado, int vel) {
    mover(lado*30, 0, lado*25, 0, vel);
    neutro(vel);
  }
  
  // ─── stomp() ─────────────────────────────────────────────────
  //  Pisotón alternado (original de tu código base).
  void stomp() {
    mover(0, 0,  0, -12, 160); mover(0, 0, 0, 0, 120);
    mover(0, 0, -12,  0, 160); mover(0, 0, 0, 0, 120);
    neutro(250);
  }
  
  // ─── stompSingle(dir, vel) ───────────────────────────────────
  //  Pisotón con pie específico. dir=+1 izq, dir=-1 der.
  void stompSingle(int dir, int vel) {
    if (dir > 0) {
      mover( 15, 0,  30, 0, vel/3);
      mover(  0, 0, -5,  0, vel/5);
    } else {
      mover(0, -15, 0,  30, vel/3);
      mover(0,   0, 0,  -5, vel/5);
    }
    delay(vel/10);
    neutro(vel/3);
  }
  
  // ─── stompAlternate(reps, vel) ───────────────────────────────
  void stompAlternate(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      stompSingle(+1, vel);
      stompSingle(-1, vel);
    }
  }
  
  // ─── hiFive(dir, vel) ────────────────────────────────────────
  //  Levantar pie como si chocara la mano. dir=+1 izq, dir=-1 der.
  void hiFive(int dir, int vel) {
    if (dir > 0) mover( 28, 0,  38, 0, vel/3);
    else         mover(0, -28, 0,  38, vel/3);
    delay(vel/4);
    neutro(vel/3);
  }
  
  // =============================================================
  //  AGACHARSE
  // =============================================================
  
  // ─── crouch(ms) ──────────────────────────────────────────────
  //  Posición agachada y volver (original de tu código base).
  void crouch(int ms) {
    musloIzq.write(constrain(NEUTRO_MUSLO_IZQ - 25, 0, 180));
    musloDer.write(constrain(NEUTRO_MUSLO_DER - 25, 0, 180));
    delay(ms);
    neutro(300);
  }
  
  // ─── squat(reps, vel) ────────────────────────────────────────
  //  Agacharse y levantarse con ciclo completo.
  void squat(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover(0, 0,  32, -32, vel/3);
      delay(vel/6);
      neutro(vel/3);
      delay(vel/6);
    }
  }
  
  // ─── squatPulse(reps, vel) ───────────────────────────────────
  //  Pulsaciones de squat desde posición semi-abajo.
  void squatPulse(int reps, int vel) {
    mover(0, 0,  20, -20, vel/4);
    for (int i = 0; i < reps; i++) {
      mover(0, 0,  32, -32, vel/5);
      mover(0, 0,  20, -20, vel/5);
    }
    neutro(vel/4);
  }
  
  // =============================================================
  //  BAILE
  // =============================================================
  
  // ─── shake() ─────────────────────────────────────────────────
  //  Vibración lateral rápida (original de tu código base).
  void shake() {
    for (int i = 0; i < 4; i++) {
      mover( 10, -10, 0, 0, 120);
      mover(-10,  10, 0, 0, 120);
    }
    neutro();
  }
  
  // ─── shimmy(reps, vel) ───────────────────────────────────────
  //  Shimmy de cadera: pies oscilan alternados, muslos fijos.
  void shimmy(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover( 20,   0, 0, 0, vel);
      mover(  0, -20, 0, 0, vel);
    }
    neutro();
  }
  
  // ─── wiggle() ────────────────────────────────────────────────
  //  Wiggle suave (original de tu código base).
  void wiggle() {
    for (int i = 0; i < 4; i++) {
      mover(  8,  -8,  4, -4, 100);
      mover( -8,   8, -4,  4, 100);
    }
    neutro();
  }
  
  // ─── tilt(lado) ──────────────────────────────────────────────
  //  Inclinarse a un lado brevemente (original de tu código base).
  void tilt(int lado) { lean(lado, 28, 400); neutro(250); }
  
  // ─── swing(reps, vel, amp) ───────────────────────────────────
  //  Balanceo de cadera: muslos oscilan en fase, pies suaves.
  void swing(int reps, int vel, int amp) {
    for (int i = 0; i < reps; i++) {
      mover( amp/3, -amp/3,  amp, -amp, vel);
      mover(-amp/3,  amp/3, -amp,  amp, vel);
    }
    neutro();
  }
  
  // ─── updown(reps, vel, amp) ──────────────────────────────────
  //  Subir y bajar: ambas rodillas se doblan y estiran al unísono.
  void updown(int reps, int vel, int amp) {
    for (int i = 0; i < reps; i++) {
      mover(0, 0,  amp, -amp, vel);
      mover(0, 0, -amp,  amp, vel);
    }
    neutro();
  }
  
  // ─── bounce(reps, vel, amp) ──────────────────────────────────
  //  Rebote rítmico: rodillas se doblan juntas como un rebote.
  void bounce(int reps, int vel, int amp) {
    for (int i = 0; i < reps; i++) {
      mover(amp/4, -amp/4,  amp, -amp, vel/2);
      mover(    0,       0,   0,    0, vel/2);
    }
    neutro();
  }
  
  // ─── bodyRoll(reps, vel) ─────────────────────────────────────
  //  Ola corporal: pies y muslos en secuencia con desfase.
  void bodyRoll(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover( 12, -12,  18, -18, vel);
      mover(  0,   0,   0,   0, vel/4);
      mover(-12,  12, -18,  18, vel);
      mover(  0,   0,   0,   0, vel/4);
    }
    neutro();
  }
  
  // ─── waveHip(dir, reps, vel) ─────────────────────────────────
  //  Ola de cadera hacia un lado. dir=+1 izq, dir=-1 der.
  void waveHip(int dir, int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover(dir*8, -dir*8,  dir*18, -dir*18, vel);
      mover(    0,       0,       0,       0, vel/4);
      mover(-dir*8, dir*8, -dir*18,  dir*18, vel);
      mover(    0,       0,       0,       0, vel/4);
    }
    neutro();
  }
  
  // ─── waveFull(reps, vel) ─────────────────────────────────────
  //  Ola completa izq + der.
  void waveFull(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      waveHip(+1, 1, vel);
      waveHip(-1, 1, vel);
    }
  }
  
  // ─── pulseLR(reps, vel) ──────────────────────────────────────
  //  Pulso lateral sincronizado: los dos pies juntos.
  void pulseLR(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover( 18,  18, 10, -10, vel/2);
      mover(-18, -18,-10,  10, vel/2);
    }
    neutro();
  }
  
  // ─── jitter(reps, vel, amp) ──────────────────────────────────
  //  Vibración rápida de cadera (solo tobillos).
  void jitter(int reps, int vel, int amp) {
    for (int i = 0; i < reps; i++) {
      mover(-amp,  amp, 0, 0, vel);
      mover( amp, -amp, 0, 0, vel);
    }
    neutro();
  }
  
  // ─── discoStep(dir, reps, vel) ───────────────────────────────
  //  Paso disco funky: cadera + tobillo con desfase.
  void discoStep(int dir, int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover(dir*18, -dir*8,  dir*22, -dir*10, vel);
      mover(-dir*8, dir*18, -dir*10,  dir*22, vel);
    }
    neutro();
  }
  
  // ─── robotStep(reps, vel) ────────────────────────────────────
  //  Pasos robóticos: movimientos rígidos con pausa entre cada uno.
  void robotStep(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover( 14,   0,  22,  0, vel/4); delay(vel/8);
      mover(  0,   0,   0,  0, vel/4); delay(vel/8);
      mover(  0, -14,   0, 22, vel/4); delay(vel/8);
      mover(  0,   0,   0,  0, vel/4); delay(vel/8);
    }
    neutro();
  }
  
  // ─── ascending(reps, vel) ────────────────────────────────────
  //  Giro ascendente: giro con subida progresiva de amplitud.
  void ascending(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      int a = 10 + i*3;
      mover(-a, a,  a+4, -(a+4), vel);
      mover( a,-a, -(a+4),  a+4, vel);
    }
    neutro();
  }
  
  // ─── tiptoe(reps, vel) ───────────────────────────────────────
  //  Swing en puntillas: muslos con offset positivo + oscillación.
  void tiptoe(int reps, int vel) {
    for (int i = 0; i < reps; i++) {
      mover(0, 0,  18, -18, vel/2);
      mover(8, -8, 18, -18, vel/2);
      mover(0, 0,  18, -18, vel/2);
      mover(-8, 8, 18, -18, vel/2);
    }
    neutro();
  }
  
  // ─── electricSlide(vel) ──────────────────────────────────────
  //  Electric Slide: 3 pasos laterales + stomp, ambos lados.
  void electricSlide(int vel) {
    sideStep(+1, 1, vel); sideStep(+1, 1, vel); sideStep(+1, 1, vel);
    stompSingle(-1, vel);
    sideStep(-1, 1, vel); sideStep(-1, 1, vel); sideStep(-1, 1, vel);
    stompSingle(+1, vel);
    neutro(300);
  }
  
  // =============================================================
  //  EXPRESIONES
  // =============================================================
  
  void scared(int vel) {
    squat(1, vel/2);
    jitter(4, 150, 18);
    neutro(400);
  }
  
  void happyDance(int vel) {
    mover(0, 0, -20, -20, 150); mover(0, 0, 15, 15, 120); neutro(250); // jump
    jitter(3, 200, 18);
    updown(2, 400, 20);
    mover(0, 0, -20, -20, 150); mover(0, 0, 15, 15, 120); neutro(250);
    neutro(300);
  }
  
  void sadWalk(int pasos, int vel) {
    for (int i = 0; i < pasos; i++) {
      mover(  8,   0,  10,   0, vel);
      mover(  0,   0,   0,   0, vel);
      mover(  0,  -8,   0,  10, vel);
      mover(  0,   0,   0,   0, vel);
    }
    neutro();
  }
  
  void dizzy(int vel) {
    girar(2, +1, vel*2);
    balance(3, vel);
    girar(2, -1, vel*2);
    neutro(500);
  }
  
  void tired(int vel) {
    balance(2, vel*2);
    squat(1, vel);
    delay(vel/2);
    neutro(800);
  }
  
  void sneeze(int vel) {
    for (int i = 0; i < 2; i++) {
      leanFB(+1, vel/3);
      delay(vel/6);
      neutro(vel/4);
      delay(vel/4);
    }
  }
  
  // =============================================================
  //  MELODÍA
  // =============================================================
  void playMelody() {
  #if USE_BUZZER
    int notes[] = {494, 523, 587, 659, 587, 523, 494};
    for (int i = 0; i < 7; i++) beepTone(notes[i], 120);
  #else
    for (int i = 0; i < 7; i++)
      mover(0, 0, (i%2==0)?3:-3, (i%2==0)?-3:3, 90);
    neutro();
  #endif
  }
  
  // =============================================================
  //  COMBOS
  // =============================================================
  void comboSalsa() {
    caminar(1, 500);
    caminarAtras(1, 500);
    sideStep(+1, 1, 500);
    sideStep(-1, 1, 500);
    swing(2, 600, 18);
    shimmy(4, 150);
    neutro(300);
  }
  
  void comboRobot() {
    robotStep(2, 700);
    jitter(3, 200, 15);
    robotStep(2, 500);
    ascending(3, 600);
    neutro(300);
  }
  
  void comboWave() {
    bodyRoll(2, 900);
    waveFull(2, 700);
    shimmy(4, 150);
    bodyRoll(1, 800);
    neutro(300);
  }
  
  void comboReggaeton() {
    bounce(4, 500, 18);
    waveHip(+1, 2, 700);
    waveHip(-1, 2, 700);
    shimmy(5, 130);
    squatPulse(3, 500);
    bounce(4, 400, 22);
    neutro(300);
  }
  
  // =============================================================
  //  COREOGRAFÍAS COMPLETAS
  // =============================================================
  
  // ─── smoothCriminal() ────────────────────────────────────────
  //  Versión reconstruida usando el sistema de neutros calibrados.
  void smoothCriminal() {
    caminar(4, 300);       neutro(500);
    lean( 1, 30, 600);     lean(-1, 30, 600);  lean( 1, 30, 600);  neutro(400);
    caminarAtras(4, 250);  neutro(400);
    shimmy(6, 150);         neutro(300);
    girar(3, 1, 200);
    kickLateral( 1, 300);  kickLateral(-1, 300); neutro(400);
    lean(1, 35, 1000);     lean(-1, 35, 1000);   neutro(500);
    crouch(600);
    caminarAtras(6, 200);  neutro(600);
    lean(1, 40, 1500);     neutro(500);
    moonwalk(4, 200, +1);
    shimmy(8, 120);         neutro(300);
    spinMove(150);
    neutro(500);
  }
  
  // ─── shakeIt() ───────────────────────────────────────────────
  //  Fiesta de sacudidas: shake + shimmy + wiggle.
  void shakeIt() {
    shake();
    shimmy(4, 150);
    wiggle();
    bounce(4, 400, 18);
    shake();
    shimmy(6, 120);
    wiggle();
    neutro(300);
  }
  
  // ─── demoAllMoves() ──────────────────────────────────────────
  //  Pasa por todos los movimientos.
  void demoAllMoves() {
    caminar(2, 300);       caminarAtras(2, 300);
    girar(2, +1, 250);     girar(2, -1, 250);
    moonwalk(3, 200, +1);  moonwalk(3, 200, -1);
    spinMove(150);
    marchF(2, 250);        marchB(2, 250);
    sneakF(2, 500);        sneakB(2, 500);
    strutF(2, 350);
    sideStep(+1, 2, 400);  sideStep(-1, 2, 400);
    sideStepFast(3, 350);
    leanSide(+1, 600);     leanSide(-1, 600);
    leanFB(+1, 600);       leanFB(-1, 600);
    balance(3, 600);
    rockLR(4, 400);        rockFB(3, 600);
    wideStand(600);
    pigeonPose(+1, 600);   pigeonPose(-1, 600);
    kickLateral(+1, 400);  kickLateral(-1, 400);
    stomp();
    stompAlternate(3, 500);
    hiFive(+1, 500);       hiFive(-1, 500);
    crouch(500);
    squat(2, 700);         squatPulse(3, 500);
    shake();
    shimmy(4, 150);
    wiggle();
    tilt(+1); tilt(-1);
    swing(3, 500, 18);     updown(3, 600, 18);
    bounce(4, 500, 18);    bounce(4, 400, 25);
    bodyRoll(2, 700);      bodyRoll(2, 450);
    waveHip(+1, 2, 600);   waveHip(-1, 2, 600);
    waveFull(2, 600);
    pulseLR(3, 600);
    jitter(4, 180, 18);
    discoStep(+1, 2, 500); discoStep(-1, 2, 500);
    robotStep(2, 700);     robotStep(3, 450);
    ascending(3, 600);
    tiptoe(2, 500);
    electricSlide(500);
    scared(600);
    happyDance(400);
    sadWalk(2, 1800);
    dizzy(600);
    tired(900);
    sneeze(400);
    comboSalsa();
    comboRobot();
    comboWave();
    comboReggaeton();
    neutro(500);
  }
  
  // =============================================================
  //  DISPATCH DE COMANDOS
  // =============================================================
  void runCommand(String command) {
    command.trim();
    command.toUpperCase();
  
    int paramValue = -1;
    int colon = command.indexOf(':');
    if (colon != -1) {
      paramValue = command.substring(colon + 1).toInt();
      command    = command.substring(0, colon);
    }
  
    // ── Locomoción ─────────────────────────────────────────────
    if(command=="WALK_F")           { caminar(2,     paramValue>0?paramValue:220);          return; }
    if(command=="WALK_B")           { caminarAtras(2,paramValue>0?paramValue:220);          return; }
    if(command=="WALK_F_FAST")      { caminar(2, 120);                                       return; }
    if(command=="WALK_F_SLOW")      { caminar(2, 400);                                       return; }
    if(command=="WALK_B_FAST")      { caminarAtras(2, 120);                                  return; }
    if(command=="WALK_B_SLOW")      { caminarAtras(2, 400);                                  return; }
    if(command=="TURN_L")           { girar(2, +1,  paramValue>0?paramValue:180);           return; }
    if(command=="TURN_R")           { girar(2, -1,  paramValue>0?paramValue:180);           return; }
    if(command=="TURN_L_FAST")      { girar(2, +1, 120);                                    return; }
    if(command=="TURN_R_FAST")      { girar(2, -1, 120);                                    return; }
    if(command=="JUMP")             { mover(0,0,-20,-20,150); mover(0,0,15,15,120); neutro(250); return; }
    if(command=="MOONWALK")         { moonwalk(2, paramValue>0?paramValue:180, +1);         return; }
    if(command=="MOONWALK_B")       { moonwalk(2, paramValue>0?paramValue:180, -1);         return; }
    if(command=="SPIN")             { spinMove(paramValue>0?paramValue:150);                return; }
    if(command=="SPIN_L")           { spinDir(+1, 4, paramValue>0?paramValue:200);          return; }
    if(command=="SPIN_R")           { spinDir(-1, 4, paramValue>0?paramValue:200);          return; }
    if(command=="SPIN_L_FAST")      { spinDir(+1, 4, 120);                                  return; }
    if(command=="SPIN_R_FAST")      { spinDir(-1, 4, 120);                                  return; }
    if(command=="MARCH_F")          { marchF(2, paramValue>0?paramValue:250);               return; }
    if(command=="MARCH_B")          { marchB(2, paramValue>0?paramValue:250);               return; }
    if(command=="SNEAK_F")          { sneakF(2, paramValue>0?paramValue:500);               return; }
    if(command=="SNEAK_B")          { sneakB(2, paramValue>0?paramValue:500);               return; }
    if(command=="STRUT_F")          { strutF(2, paramValue>0?paramValue:350);               return; }
    if(command=="STRUT_B")          { strutB(2, paramValue>0?paramValue:350);               return; }
  
    // ── Laterales y balance ────────────────────────────────────
    if(command=="SIDE_STEP_L")      { sideStep(+1, 2, paramValue>0?paramValue:400);        return; }
    if(command=="SIDE_STEP_R")      { sideStep(-1, 2, paramValue>0?paramValue:400);        return; }
    if(command=="SIDE_STEP_FAST")   { sideStepFast(4, paramValue>0?paramValue:300);        return; }
    if(command=="LEAN_L")           { leanSide(+1, paramValue>0?paramValue:700);           return; }
    if(command=="LEAN_R")           { leanSide(-1, paramValue>0?paramValue:700);           return; }
    if(command=="LEAN_F")           { leanFB(+1,   paramValue>0?paramValue:700);           return; }
    if(command=="LEAN_B")           { leanFB(-1,   paramValue>0?paramValue:700);           return; }
    if(command=="BALANCE")          { balance(4,   paramValue>0?paramValue:700);           return; }
    if(command=="ROCK_LR")          { rockLR(4,    paramValue>0?paramValue:400);           return; }
    if(command=="ROCK_LR_FAST")     { rockLR(6, 250);                                       return; }
    if(command=="ROCK_FB")          { rockFB(4,    paramValue>0?paramValue:600);           return; }
    if(command=="WIDE_STAND")       { wideStand(   paramValue>0?paramValue:600);           return; }
    if(command=="PIGEON_L")         { pigeonPose(+1,paramValue>0?paramValue:600);          return; }
    if(command=="PIGEON_R")         { pigeonPose(-1,paramValue>0?paramValue:600);          return; }
  
    // ── Patadas y pisotones ────────────────────────────────────
    if(command=="KICK_L")           { kickLateral(+1, paramValue>0?paramValue:400);        return; }
    if(command=="KICK_R")           { kickLateral(-1, paramValue>0?paramValue:400);        return; }
    if(command=="STOMP")            { stomp();                                               return; }
    if(command=="STOMP_L")          { stompSingle(+1, paramValue>0?paramValue:500);        return; }
    if(command=="STOMP_R")          { stompSingle(-1, paramValue>0?paramValue:500);        return; }
    if(command=="STOMP_ALTERNATE")  { stompAlternate(4, paramValue>0?paramValue:500);      return; }
    if(command=="HI_FIVE_L")        { hiFive(+1, paramValue>0?paramValue:500);             return; }
    if(command=="HI_FIVE_R")        { hiFive(-1, paramValue>0?paramValue:500);             return; }
  
    // ── Agacharse ──────────────────────────────────────────────
    if(command=="CROUCH")           { crouch(paramValue>0?paramValue:500);                 return; }
    if(command=="SQUAT")            { squat(2,      paramValue>0?paramValue:700);          return; }
    if(command=="SQUAT_PULSE")      { squatPulse(3, paramValue>0?paramValue:500);          return; }
  
    // ── Baile ──────────────────────────────────────────────────
    if(command=="SHAKE")            { shake();                                               return; }
    if(command=="SHIMMY")           { shimmy(4, paramValue>0?paramValue:150);              return; }
    if(command=="SHIMMY_SLOW")      { shimmy(3, 300);                                       return; }
    if(command=="WIGGLE")           { wiggle();                                              return; }
    if(command=="TILT_L")           { tilt(+1);                                             return; }
    if(command=="TILT_R")           { tilt(-1);                                             return; }
    if(command=="SWING")            { swing(3, paramValue>0?paramValue:500, 18);           return; }
    if(command=="SWING_BIG")        { swing(3, 500, 28);                                    return; }
    if(command=="UPDOWN")           { updown(3, paramValue>0?paramValue:500, 18);          return; }
    if(command=="UPDOWN_BIG")       { updown(3, 500, 28);                                   return; }
    if(command=="BOUNCE")           { bounce(4, paramValue>0?paramValue:500, 18);          return; }
    if(command=="BOUNCE_BIG")       { bounce(4, 400, 26);                                   return; }
    if(command=="BODY_ROLL")        { bodyRoll(2, paramValue>0?paramValue:700);            return; }
    if(command=="BODY_ROLL_FAST")   { bodyRoll(2, 400);                                     return; }
    if(command=="WAVE_L")           { waveHip(+1, 2, paramValue>0?paramValue:600);        return; }
    if(command=="WAVE_R")           { waveHip(-1, 2, paramValue>0?paramValue:600);        return; }
    if(command=="WAVE_FULL")        { waveFull(2,    paramValue>0?paramValue:600);         return; }
    if(command=="PULSE_LR")         { pulseLR(4,     paramValue>0?paramValue:600);         return; }
    if(command=="JITTER")           { jitter(4, paramValue>0?paramValue:180, 18);          return; }
    if(command=="JITTER_SMALL")     { jitter(4, 180, 10);                                   return; }
    if(command=="DISCO_L")          { discoStep(+1, 2, paramValue>0?paramValue:500);       return; }
    if(command=="DISCO_R")          { discoStep(-1, 2, paramValue>0?paramValue:500);       return; }
    if(command=="ROBOT_STEP")       { robotStep(2,  paramValue>0?paramValue:700);          return; }
    if(command=="ROBOT_STEP_FAST")  { robotStep(3,  400);                                   return; }
    if(command=="ASCENDING")        { ascending(3,  paramValue>0?paramValue:600);          return; }
    if(command=="TIPTOE")           { tiptoe(2,     paramValue>0?paramValue:500);          return; }
    if(command=="ELECTRIC_SLIDE")   { electricSlide(paramValue>0?paramValue:500);          return; }
  
    // ── Expresiones ────────────────────────────────────────────
    if(command=="SCARED")           { scared(500);             return; }
    if(command=="HAPPY_DANCE")      { happyDance(400);         return; }
    if(command=="SAD_WALK")         { sadWalk(2, 1800);        return; }
    if(command=="DIZZY")            { dizzy(600);              return; }
    if(command=="TIRED")            { tired(900);              return; }
    if(command=="SNEEZE")           { sneeze(400);             return; }
  
    // ── Utilidades ─────────────────────────────────────────────
    if(command=="HOME"  || command=="NEUTRO") { neutro(paramValue>0?paramValue:400); return; }
    if(command=="FREEZE")           { neutro(paramValue>0?paramValue:300);           return; }
    if(command=="PAUSE")            { if(paramValue>0) delay(paramValue); else neutro(300); return; }
    if(command=="BEEP")             { beepTone(880, 160);      return; }
    if(command=="MELODY")           { playMelody();            return; }
  
    // ── Combos ─────────────────────────────────────────────────
    if(command=="COMBO_SALSA")      { comboSalsa();       return; }
    if(command=="COMBO_ROBOT")      { comboRobot();       return; }
    if(command=="COMBO_WAVE")       { comboWave();        return; }
    if(command=="COMBO_REGGAETON")  { comboReggaeton();   return; }
  
    // ── Coreografías ───────────────────────────────────────────
    if(command=="D" || command=="SMOOTH" || command=="SMOOTH_CRIMINAL") { smoothCriminal(); return; }
    if(command=="SHAKE_IT")         { shakeIt();          return; }
    if(command=="DEMO" || command=="ALL") { demoAllMoves(); return; }
  
    // Comando desconocido → neutro
    neutro(200);
  }
  
  // =============================================================
  //  SEQ PARSER
  // =============================================================
  void runSequence(String seq) {
    seq.trim();
    Serial.print("[SEQ] "); Serial.println(seq);
    int start = 0;
    while (start < (int)seq.length()) {
      int comma = seq.indexOf(',', start);
      String cmd;
      if (comma == -1) { cmd = seq.substring(start); start = seq.length(); }
      else             { cmd = seq.substring(start, comma); start = comma + 1; }
      cmd.trim();
      if (cmd.length() == 0) continue;
      Serial.print("  → "); Serial.println(cmd);
      runCommand(cmd);
    }
    Serial.println("[SEQ] Done.");
  }
  
  void dispatch(String raw) {
    raw.trim();
    if (raw.length() == 0) return;
    Serial.print("[CMD] "); Serial.println(raw);
    String upper = raw; upper.toUpperCase();
    if (upper.startsWith("SEQ:")) runSequence(raw.substring(4));
    else                           runCommand(raw);
  }
  
  // =============================================================
  //  BLE CALLBACKS
  // =============================================================
  class RxCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pChar) override {
      String chunk = pChar->getValue();
      if (chunk.length() == 0) return;
      seqBuffer += chunk;
      int nl = seqBuffer.indexOf('\n');
      while (nl != -1) {
        String line = seqBuffer.substring(0, nl);
        seqBuffer = seqBuffer.substring(nl + 1);
        dispatch(line);
        nl = seqBuffer.indexOf('\n');
      }
      if (seqBuffer.length() > 512) {
        Serial.println("[WARN] Buffer overflow, clearing.");
        seqBuffer = "";
      }
    }
  };
  
  class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) override {
      deviceConnected = true; seqBuffer = "";
      Serial.println("[BLE] Client connected.");
    }
    void onDisconnect(BLEServer *pServer) override {
      deviceConnected = false; seqBuffer = "";
      Serial.println("[BLE] Client disconnected. Restarting advertising...");
      delay(500);
      pServer->startAdvertising();
    }
  };
  
  // =============================================================
  //  SETUP
  // =============================================================
  void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);
  
    // 1. Pines en LOW — evita movimiento al arrancar
    pinMode(PIN_PIE_IZQ,   OUTPUT); digitalWrite(PIN_PIE_IZQ,   LOW);
    pinMode(PIN_PIE_DER,   OUTPUT); digitalWrite(PIN_PIE_DER,   LOW);
    pinMode(PIN_MUSLO_IZQ, OUTPUT); digitalWrite(PIN_MUSLO_IZQ, LOW);
    pinMode(PIN_MUSLO_DER, OUTPUT); digitalWrite(PIN_MUSLO_DER, LOW);
    delay(100);
  
  #if USE_BUZZER
    pinMode(PIN_BUZZER, OUTPUT);
  #endif
  
    // 2. BLE primero — reduce pico de corriente al arrancar servos
    BLEDevice::init("Otto-BT-001");
    BLEDevice::setMTU(247);
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new ServerCallbacks());
  
    BLEService *uartService = bleServer->createService(OTTO_UART_SERVICE_UUID);
    BLECharacteristic *rxChar = uartService->createCharacteristic(
      OTTO_UART_RX_UUID,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
    );
    rxChar->setCallbacks(new RxCallbacks());
    uartService->start();
  
    BLEService *batteryService = bleServer->createService(OTTO_BATTERY_SERVICE_UUID);
    BLECharacteristic *batteryLevel = batteryService->createCharacteristic(
      OTTO_BATTERY_LEVEL_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    batteryLevel->addDescriptor(new BLE2902());
    batteryLevel->setValue((uint8_t)85);
    batteryService->start();
  
    BLEAdvertising *adv = BLEDevice::getAdvertising();
    adv->addServiceUUID(OTTO_UART_SERVICE_UUID);
    adv->setScanResponse(true);
    adv->setMinPreferred(0x06);
    adv->setMaxPreferred(0x12);
    BLEDevice::startAdvertising();
  
    // 3. Servos al último
    pieIzq.attach(PIN_PIE_IZQ);
    pieDer.attach(PIN_PIE_DER);
    musloIzq.attach(PIN_MUSLO_IZQ);
    musloDer.attach(PIN_MUSLO_DER);
  
    neutro(1000);
  
    Serial.println(F("\n╔══════════════════════════════════════════════════════════════╗"));
    Serial.println(F("║   Otto BLE v3 – Neutros calibrados + Movimientos Extendidos  ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ NEUTROS: PIE_IZQ=120  PIE_DER=65  MUSLO_IZQ=105  MUSLO_DER=105║"));
    Serial.println(F("║ (todos los offsets se suman al neutro de cada servo)          ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ LOCOMOCIÓN: WALK_F/B  TURN_L/R  JUMP  MOONWALK  SPIN        ║"));
    Serial.println(F("║             MARCH_F/B  SNEAK_F/B  STRUT_F/B                  ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ LATERALES:  SIDE_STEP_L/R/FAST  LEAN_L/R/F/B                ║"));
    Serial.println(F("║             BALANCE  ROCK_LR/FB  WIDE_STAND  PIGEON_L/R     ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ PATADAS:    KICK_L/R  STOMP  STOMP_L/R  STOMP_ALTERNATE     ║"));
    Serial.println(F("║             HI_FIVE_L/R  CROUCH  SQUAT  SQUAT_PULSE         ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ BAILE:      SHAKE  SHIMMY  WIGGLE  TILT_L/R  SWING  UPDOWN  ║"));
    Serial.println(F("║  BOUNCE  BODY_ROLL  WAVE_L/R  WAVE_FULL  PULSE_LR  JITTER   ║"));
    Serial.println(F("║  DISCO_L/R  ROBOT_STEP  ASCENDING  TIPTOE  ELECTRIC_SLIDE   ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ EXPRESIONES: SCARED  HAPPY_DANCE  SAD_WALK  DIZZY  TIRED    ║"));
    Serial.println(F("║              SNEEZE                                           ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ COMBOS: COMBO_SALSA  COMBO_ROBOT  COMBO_WAVE  COMBO_REGGAETON║"));
    Serial.println(F("║ COREO:  SMOOTH  SHAKE_IT  DEMO                               ║"));
    Serial.println(F("╠══════════════════════════════════════════════════════════════╣"));
    Serial.println(F("║ SEQ:CMD1,CMD2,...  |  CMD:VELOCIDAD (ej: WALK_F:300)         ║"));
    Serial.println(F("╚══════════════════════════════════════════════════════════════╝"));
  }
  
  // =============================================================
  //  LOOP
  // =============================================================
  void loop() {
    if (Serial.available()) {
      String line = Serial.readStringUntil('\n');
      line.trim();
      if (line.length() > 0) dispatch(line);
    }
    delay(10);
  }
