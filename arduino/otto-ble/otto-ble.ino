// =============================================================
//  Otto DIY v1 – ESP32 BLE  |  MOVIMIENTOS EXTENDIDOS v3
//  FIX: stack BLE en Core 0, servos en Core 1 via FreeRTOS Queue.
//  Los delay() dentro de mover() se reemplazaron por vTaskDelay()
//  para que el watchdog y el stack BLE nunca se bloqueen.
//
//  Servo order:
//    pieIzq   = tobillo izquierdo   pin PIN_PIE_IZQ
//    pieDer   = tobillo derecho     pin PIN_PIE_DER
//    musloIzq = muslo izquierdo     pin PIN_MUSLO_IZQ
//    musloDer = muslo derecho       pin PIN_MUSLO_DER
//
//  TODOS los ángulos son OFFSETS sobre el neutro calibrado.
//
//  COMANDOS BLE / Serial (terminar con \n)  — misma API que antes
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
#define NEUTRO_PIE_IZQ    120
#define NEUTRO_PIE_DER     65
#define NEUTRO_MUSLO_IZQ  105
#define NEUTRO_MUSLO_DER  105

// ── FreeRTOS Queue ─────────────────────────────────────────
// Los callbacks BLE/Serial encolan strings; la tarea de servos los consume.
#define CMD_MAX_LEN 64
#define CMD_QUEUE_SIZE 16
static QueueHandle_t cmdQueue = nullptr;

// ── Servos ─────────────────────────────────────────────────
Servo pieIzq, pieDer, musloIzq, musloDer;

// ── BLE ────────────────────────────────────────────────────
BLEServer *bleServer    = nullptr;
bool deviceConnected    = false;
String seqBuffer        = "";

// =============================================================
//  MOTOR BASE — usa vTaskDelay en lugar de delay()
//  para no bloquear el scheduler de FreeRTOS
// =============================================================
void mover(int oi, int od, int mi, int md, int ms) {
  pieIzq.write  (constrain(NEUTRO_PIE_IZQ   + oi, 0, 180));
  pieDer.write  (constrain(NEUTRO_PIE_DER   + od, 0, 180));
  musloIzq.write(constrain(NEUTRO_MUSLO_IZQ + mi, 0, 180));
  musloDer.write(constrain(NEUTRO_MUSLO_DER + md, 0, 180));
  vTaskDelay(pdMS_TO_TICKS(ms));
}

void neutro(int ms = 400) {
  mover(0, 0, 0, 0, ms);
}

void beepTone(int freq, int ms) {
#if USE_BUZZER
  tone(PIN_BUZZER, freq, ms); vTaskDelay(pdMS_TO_TICKS(ms + 20)); noTone(PIN_BUZZER);
#else
  vTaskDelay(pdMS_TO_TICKS(ms));
#endif
}

// =============================================================
//  LOCOMOCIÓN
// =============================================================
void caminar(int pasos, int vel) {
  for (int i = 0; i < pasos; i++) {
    mover( 15,   0,  20,   0, vel);
    mover(  0,   0,   0,   0, vel);
    mover(  0, -15,   0,  20, vel);
    mover(  0,   0,   0,   0, vel);
  }
  neutro();
}

void caminarAtras(int pasos, int vel) {
  for (int i = 0; i < pasos; i++) {
    mover( 20,   0, -15,   0, vel);
    mover(  0,   0,   0,   0, vel);
    mover(  0, -20,   0,  15, vel);
    mover(  0,   0,   0,   0, vel);
  }
  neutro();
}

void girar(int pasos, int dir, int vel) {
  for (int i = 0; i < pasos; i++) {
    mover(dir * 20,         0,  dir * 15,          0, vel);
    mover(         0, dir * 20,           0, dir * 15, vel);
  }
  neutro();
}

void moonwalk(int pasos, int vel, int dir) {
  for (int i = 0; i < pasos; i++) {
    mover( dir*20,    0, -dir*15,      0, vel);
    mover(       0,   0,        0,     0, vel);
    mover(       0, -dir*20,    0, dir*15, vel);
    mover(       0,   0,        0,     0, vel);
  }
  neutro();
}

void spinMove(int vel) {
  for (int i = 0; i < 4; i++) {
    mover( 20,   0,  15, -10, vel);
    mover(  0,  20, -10,  15, vel);
  }
  neutro();
}

void spinDir(int dir, int pasos, int vel) {
  girar(pasos, dir, vel);
}

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
void sideStep(int dir, int pasos, int vel) {
  for (int i = 0; i < pasos; i++) {
    mover(dir*20,  dir*10, -dir*12,  dir*5, vel);
    mover(      0,       0,       0,      0, vel/2);
    mover(dir*10,  dir*20,  dir*5, -dir*12, vel);
    mover(      0,       0,       0,      0, vel/2);
  }
  neutro();
}

void sideStepFast(int pasos, int vel) {
  for (int i = 0; i < pasos; i++) {
    sideStep(+1, 1, vel);
    sideStep(-1, 1, vel);
  }
}

void lean(int lado, int angulo, int ms) {
  musloIzq.write(constrain(NEUTRO_MUSLO_IZQ + lado * angulo, 0, 180));
  musloDer.write(constrain(NEUTRO_MUSLO_DER + lado * angulo, 0, 180));
  vTaskDelay(pdMS_TO_TICKS(ms));
}

void leanSide(int dir, int vel) {
  mover(dir*25, dir*8,  dir*15, dir*8, vel/2);
  vTaskDelay(pdMS_TO_TICKS(vel/4));
  neutro(vel/2);
}

void leanFB(int dir, int vel) {
  mover(0, 0, dir*20, -dir*20, vel/2);
  vTaskDelay(pdMS_TO_TICKS(vel/4));
  neutro(vel/2);
}

void balance(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover( 18,  6,  8,  4, vel);
    mover( -6,-18, -4, -8, vel);
  }
  neutro();
}

void rockLR(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover( 25, -10,  10, -5, vel/4);
    mover(-10,  25,  -5, 10, vel/4);
  }
  neutro(vel/4);
}

void rockFB(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover(0, 0,  18, -18, vel/3);
    mover(0, 0, -18,  18, vel/3);
  }
  neutro(vel/3);
}

void wideStand(int vel) {
  mover(25, -25, 0, 0, vel/2);
  vTaskDelay(pdMS_TO_TICKS(vel/4));
  neutro(vel/2);
}

void pigeonPose(int dir, int vel) {
  if (dir > 0) mover(-22, 0, 14, 0, vel/2);
  else         mover(0, 22, 0, -14, vel/2);
  vTaskDelay(pdMS_TO_TICKS(vel/4));
  neutro(vel/2);
}

// =============================================================
//  PATADAS Y PISOTONES
// =============================================================
void kickLateral(int lado, int vel) {
  mover(lado*30, 0, lado*25, 0, vel);
  neutro(vel);
}

void stomp() {
  mover(0, 0,  0, -12, 160); mover(0, 0, 0, 0, 120);
  mover(0, 0, -12,  0, 160); mover(0, 0, 0, 0, 120);
  neutro(250);
}

void stompSingle(int dir, int vel) {
  if (dir > 0) {
    mover( 15, 0,  30, 0, vel/3);
    mover(  0, 0,  -5, 0, vel/5);
  } else {
    mover(0, -15, 0,  30, vel/3);
    mover(0,   0, 0,  -5, vel/5);
  }
  vTaskDelay(pdMS_TO_TICKS(vel/10));
  neutro(vel/3);
}

void stompAlternate(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    stompSingle(+1, vel);
    stompSingle(-1, vel);
  }
}

void hiFive(int dir, int vel) {
  if (dir > 0) mover( 28, 0,  38, 0, vel/3);
  else         mover(0, -28, 0,  38, vel/3);
  vTaskDelay(pdMS_TO_TICKS(vel/4));
  neutro(vel/3);
}

// =============================================================
//  AGACHARSE
// =============================================================
void crouch(int ms) {
  musloIzq.write(constrain(NEUTRO_MUSLO_IZQ - 25, 0, 180));
  musloDer.write(constrain(NEUTRO_MUSLO_DER - 25, 0, 180));
  vTaskDelay(pdMS_TO_TICKS(ms));
  neutro(300);
}

void squat(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover(0, 0,  32, -32, vel/3);
    vTaskDelay(pdMS_TO_TICKS(vel/6));
    neutro(vel/3);
    vTaskDelay(pdMS_TO_TICKS(vel/6));
  }
}

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
void shake() {
  for (int i = 0; i < 4; i++) {
    mover( 10, -10, 0, 0, 120);
    mover(-10,  10, 0, 0, 120);
  }
  neutro();
}

void shimmy(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover( 20,   0, 0, 0, vel);
    mover(  0, -20, 0, 0, vel);
  }
  neutro();
}

void wiggle() {
  for (int i = 0; i < 4; i++) {
    mover(  8,  -8,  4, -4, 100);
    mover( -8,   8, -4,  4, 100);
  }
  neutro();
}

void tilt(int lado) { lean(lado, 28, 400); neutro(250); }

void swing(int reps, int vel, int amp) {
  for (int i = 0; i < reps; i++) {
    mover( amp/3, -amp/3,  amp, -amp, vel);
    mover(-amp/3,  amp/3, -amp,  amp, vel);
  }
  neutro();
}

void updown(int reps, int vel, int amp) {
  for (int i = 0; i < reps; i++) {
    mover(0, 0,  amp, -amp, vel);
    mover(0, 0, -amp,  amp, vel);
  }
  neutro();
}

void bounce(int reps, int vel, int amp) {
  for (int i = 0; i < reps; i++) {
    mover(amp/4, -amp/4,  amp, -amp, vel/2);
    mover(    0,       0,   0,    0, vel/2);
  }
  neutro();
}

void bodyRoll(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover( 12, -12,  18, -18, vel);
    mover(  0,   0,   0,   0, vel/4);
    mover(-12,  12, -18,  18, vel);
    mover(  0,   0,   0,   0, vel/4);
  }
  neutro();
}

void waveHip(int dir, int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover(dir*8, -dir*8,  dir*18, -dir*18, vel);
    mover(    0,       0,       0,       0, vel/4);
    mover(-dir*8, dir*8, -dir*18,  dir*18, vel);
    mover(    0,       0,       0,       0, vel/4);
  }
  neutro();
}

void waveFull(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    waveHip(+1, 1, vel);
    waveHip(-1, 1, vel);
  }
}

void pulseLR(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover( 18,  18, 10, -10, vel/2);
    mover(-18, -18,-10,  10, vel/2);
  }
  neutro();
}

void jitter(int reps, int vel, int amp) {
  for (int i = 0; i < reps; i++) {
    mover(-amp,  amp, 0, 0, vel);
    mover( amp, -amp, 0, 0, vel);
  }
  neutro();
}

void discoStep(int dir, int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover(dir*18, -dir*8,  dir*22, -dir*10, vel);
    mover(-dir*8, dir*18, -dir*10,  dir*22, vel);
  }
  neutro();
}

void robotStep(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover( 14,   0,  22,  0, vel/4); vTaskDelay(pdMS_TO_TICKS(vel/8));
    mover(  0,   0,   0,  0, vel/4); vTaskDelay(pdMS_TO_TICKS(vel/8));
    mover(  0, -14,   0, 22, vel/4); vTaskDelay(pdMS_TO_TICKS(vel/8));
    mover(  0,   0,   0,  0, vel/4); vTaskDelay(pdMS_TO_TICKS(vel/8));
  }
  neutro();
}

void ascending(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    int a = 10 + i*3;
    mover(-a, a,  a+4, -(a+4), vel);
    mover( a,-a, -(a+4),  a+4, vel);
  }
  neutro();
}

void tiptoe(int reps, int vel) {
  for (int i = 0; i < reps; i++) {
    mover(0, 0,  18, -18, vel/2);
    mover(8, -8, 18, -18, vel/2);
    mover(0, 0,  18, -18, vel/2);
    mover(-8, 8, 18, -18, vel/2);
  }
  neutro();
}

void electricSlide(int vel) {
  sideStep(-1, 3, vel); stomp();
  sideStep(+1, 3, vel); stomp();
  girar(1, -1, vel);    stomp();
}

// =============================================================
//  EXPRESIONES
// =============================================================
void scared(int vel) {
  mover( 20, -20,  15, -15, vel/3);
  mover(-20,  20, -15,  15, vel/3);
  mover( 20, -20,  15, -15, vel/3);
  neutro(vel);
}

void happyDance(int vel) {
  for (int i = 0; i < 3; i++) {
    mover( 15, -15,  20, -20, vel/2);
    mover(-15,  15, -20,  20, vel/2);
  }
  spinMove(vel);
  neutro(400);
}

void sadWalk(int pasos, int vel) {
  for (int i = 0; i < pasos; i++) {
    mover(  8,   0,  10,   0, vel);
    mover(  0,   0,   0,   0, vel/2);
    mover(  0,  -8,   0,  10, vel);
    mover(  0,   0,   0,   0, vel/2);
  }
  neutro();
}

void dizzy(int vel) {
  for (int i = 0; i < 3; i++) {
    girar(1, +1, vel); girar(1, -1, vel);
  }
  neutro();
}

void tired(int vel) {
  lean(+1, 20, vel/2);
  lean(-1, 20, vel/2);
  neutro(vel/2);
}

void sneeze(int vel) {
  mover(0, 0,  15, -15, vel/4);
  mover(0, 0, -10,  10, vel/6);
  neutro(vel/2);
  beepTone(600, 80);
}

// =============================================================
//  COMBOS
// =============================================================
void comboSalsa() {
  shimmy(4, 130); sideStep(+1, 1, 350); sideStep(-1, 1, 350);
  swing(2, 400, 20); neutro(200);
}

void comboRobot() {
  robotStep(2, 600); jitter(3, 150, 15); robotStep(1, 500);
  mover(20,-20,15,-15,300); neutro(400);
}

void comboWave() {
  waveFull(1, 500); balance(2, 600); waveHip(+1,1,500);
  waveHip(-1,1,500); neutro(300);
}

void comboReggaeton() {
  bounce(4, 350, 20); shimmy(4, 130); sideStep(+1,1,300);
  sideStep(-1,1,300); bounce(2, 350, 25); neutro(200);
}

void playMelody() {
#if USE_BUZZER
  int notes[] = {262,294,330,349,392,440,494,523};
  for (int i = 0; i < 8; i++) { beepTone(notes[i], 180); }
#else
  vTaskDelay(pdMS_TO_TICKS(1600));
#endif
}

// =============================================================
//  COREOGRAFÍAS
// =============================================================
void smoothCriminal() {
  shimmy(4, 140); neutro(200);
  moonwalk(3, 180, +1); neutro(300);
  sideStep(+1, 2, 300); sideStep(-1, 2, 300);
  spinMove(150);
  caminar(4, 250); neutro(400);
  caminarAtras(6, 200); neutro(600);
  lean(1, 40, 1500); neutro(500);
  moonwalk(4, 200, +1);
  shimmy(8, 120); neutro(300);
  spinMove(150);
  neutro(500);
}

void shakeIt() {
  shake(); shimmy(4, 150); wiggle();
  bounce(4, 400, 18); shake();
  shimmy(6, 120); wiggle(); neutro(300);
}

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
  if(command=="KICK_L")           { kickLateral(+1, paramValue>0?paramValue:400);        return; }
  if(command=="KICK_R")           { kickLateral(-1, paramValue>0?paramValue:400);        return; }
  if(command=="STOMP")            { stomp();                                               return; }
  if(command=="STOMP_L")          { stompSingle(+1, paramValue>0?paramValue:500);        return; }
  if(command=="STOMP_R")          { stompSingle(-1, paramValue>0?paramValue:500);        return; }
  if(command=="STOMP_ALTERNATE")  { stompAlternate(4, paramValue>0?paramValue:500);      return; }
  if(command=="HI_FIVE_L")        { hiFive(+1, paramValue>0?paramValue:500);             return; }
  if(command=="HI_FIVE_R")        { hiFive(-1, paramValue>0?paramValue:500);             return; }
  if(command=="CROUCH")           { crouch(paramValue>0?paramValue:500);                 return; }
  if(command=="SQUAT")            { squat(2,      paramValue>0?paramValue:700);          return; }
  if(command=="SQUAT_PULSE")      { squatPulse(3, paramValue>0?paramValue:500);          return; }
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
  if(command=="SCARED")           { scared(500);             return; }
  if(command=="HAPPY_DANCE")      { happyDance(400);         return; }
  if(command=="SAD_WALK")         { sadWalk(2, 1800);        return; }
  if(command=="DIZZY")            { dizzy(600);              return; }
  if(command=="TIRED")            { tired(900);              return; }
  if(command=="SNEEZE")           { sneeze(400);             return; }
  if(command=="HOME"  || command=="NEUTRO") { neutro(paramValue>0?paramValue:400); return; }
  if(command=="FREEZE")           { neutro(paramValue>0?paramValue:300);           return; }
  if(command=="PAUSE")            { if(paramValue>0) vTaskDelay(pdMS_TO_TICKS(paramValue)); else neutro(300); return; }
  if(command=="BEEP")             { beepTone(880, 160);      return; }
  if(command=="MELODY")           { playMelody();            return; }
  if(command=="COMBO_SALSA")      { comboSalsa();       return; }
  if(command=="COMBO_ROBOT")      { comboRobot();       return; }
  if(command=="COMBO_WAVE")       { comboWave();        return; }
  if(command=="COMBO_REGGAETON")  { comboReggaeton();   return; }
  if(command=="D" || command=="SMOOTH" || command=="SMOOTH_CRIMINAL") { smoothCriminal(); return; }
  if(command=="SHAKE_IT")         { shakeIt();          return; }
  if(command=="DEMO" || command=="ALL") { demoAllMoves(); return; }

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
    Serial.print("  -> "); Serial.println(cmd);
    runCommand(cmd);
  }
  Serial.println("[SEQ] Done.");
}

// =============================================================
//  DISPATCH — encola el comando en lugar de ejecutarlo
//  directamente desde el callback BLE (que corre en Core 0)
// =============================================================
void dispatch(String raw) {
  raw.trim();
  if (raw.length() == 0) return;
  Serial.print("[CMD] "); Serial.println(raw);

  // Copiar a buffer fijo para la queue
  char buf[CMD_MAX_LEN];
  raw.toCharArray(buf, CMD_MAX_LEN);
  if (xQueueSend(cmdQueue, buf, 0) != pdTRUE) {
    Serial.println("[WARN] Queue llena, comando descartado.");
  }
}

// =============================================================
//  TAREA DE SERVOS — corre en Core 1
//  Consume la queue y ejecuta los comandos.
//  Como corre en su propio task de FreeRTOS, el vTaskDelay
//  dentro de mover() cede el CPU sin bloquear Core 0.
// =============================================================
void servoTask(void *pvParameters) {
  char buf[CMD_MAX_LEN];
  for (;;) {
    if (xQueueReceive(cmdQueue, buf, portMAX_DELAY) == pdTRUE) {
      String raw = String(buf);
      String upper = raw; upper.toUpperCase();
      if (upper.startsWith("SEQ:")) runSequence(raw.substring(4));
      else                           runCommand(raw);
    }
  }
}

// =============================================================
//  BLE CALLBACKS — corren en Core 0 (stack BLE)
//  Solo encolan; nunca bloquean
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
    vTaskDelay(pdMS_TO_TICKS(500));
    pServer->startAdvertising();
  }
};

// =============================================================
//  SETUP
// =============================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.begin(115200);

  // 1. Crear la queue ANTES de todo
  cmdQueue = xQueueCreate(CMD_QUEUE_SIZE, CMD_MAX_LEN);

  // 2. Pines en LOW
  pinMode(PIN_PIE_IZQ,   OUTPUT); digitalWrite(PIN_PIE_IZQ,   LOW);
  pinMode(PIN_PIE_DER,   OUTPUT); digitalWrite(PIN_PIE_DER,   LOW);
  pinMode(PIN_MUSLO_IZQ, OUTPUT); digitalWrite(PIN_MUSLO_IZQ, LOW);
  pinMode(PIN_MUSLO_DER, OUTPUT); digitalWrite(PIN_MUSLO_DER, LOW);
  delay(100);

#if USE_BUZZER
  pinMode(PIN_BUZZER, OUTPUT);
#endif

  // 3. BLE en Core 0 (donde ya vive el stack BLE de ESP32)
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

  // 4. Servos
  pieIzq.attach(PIN_PIE_IZQ);
  pieDer.attach(PIN_PIE_DER);
  musloIzq.attach(PIN_MUSLO_IZQ);
  musloDer.attach(PIN_MUSLO_DER);

  // 5. Tarea de servos en Core 1 (CPU distinto al stack BLE)
  xTaskCreatePinnedToCore(
    servoTask,    // función
    "servoTask",  // nombre
    8192,         // stack bytes
    nullptr,      // parámetros
    1,            // prioridad
    nullptr,      // handle
    1             // Core 1
  );

  neutro(1000);

  Serial.println(F("\n[Otto BLE v3 FreeRTOS] Listo. BLE=Core0, Servos=Core1"));
  Serial.println(F("Comandos: WALK_F/B  TURN_L/R  JUMP  MOONWALK  SPIN  SHIMMY  WIGGLE  ..."));
}

// =============================================================
//  LOOP — solo lee Serial y encola (Core 1)
// =============================================================
void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) dispatch(line);
  }
  vTaskDelay(pdMS_TO_TICKS(10));
}
