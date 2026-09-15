import { describe, expect, it } from 'vitest';
import { immersiveMode } from './pwa';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.34.108]',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; SM-S921B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('pantalla completa durante la prueba', () => {
  it('usa la pantalla completa del navegador cuando existe', () => {
    expect(immersiveMode(UA.androidChrome, false, true)).toBe('fullscreen');
    expect(immersiveMode(UA.desktop, false, true)).toBe('fullscreen');
  });

  it('en iPhone y en apps como Instagram explica cómo lograrlo', () => {
    expect(immersiveMode(UA.iphoneSafari, false, false)).toBe('ios');
    expect(immersiveMode(UA.iphoneChrome, false, false)).toBe('ios');
    expect(immersiveMode(UA.iphoneInstagram, false, false)).toBe('in-app');
    expect(immersiveMode(UA.iphoneFacebook, false, false)).toBe('in-app');
    expect(immersiveMode(UA.androidWebView, false, true)).toBe('in-app');
  });

  it('no se muestra si ya no hay barra del navegador o no hay forma de ocultarla', () => {
    expect(immersiveMode(UA.iphoneSafari, true, false)).toBe('none');
    expect(immersiveMode(UA.androidChrome, true, true)).toBe('none');
    expect(immersiveMode(UA.desktop, false, false)).toBe('none');
  });
});
