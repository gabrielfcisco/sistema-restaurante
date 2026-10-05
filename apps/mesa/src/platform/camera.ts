import jsQR from 'jsqr';
export interface CameraAdapter { start(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> }
export const browserCamera: CameraAdapter = {
  async start(video, onCode) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera indisponível neste dispositivo. Digite o código do cartão.');
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 } }, audio: false }); }
    catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      throw new Error(name === 'NotAllowedError' ? 'Permissão de câmera negada. Permita o acesso ou digite o código.' : 'Não foi possível abrir a câmera. Digite o código do cartão.');
    }
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { stopped = true; if (timer) clearTimeout(timer); stream.getTracks().forEach(track => track.stop()); video.srcObject = null; };
    video.srcObject = stream;
    try { await video.play(); } catch { stop(); throw new Error('Não foi possível iniciar o vídeo. Digite o código do cartão.'); }
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) { stop(); throw new Error('Leitor de QR indisponível. Digite o código do cartão.'); }
    const scan = () => {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
        if (result) { stop(); onCode(result.data); return; }
      }
      timer = setTimeout(scan, 180);
    };
    scan();
    return stop;
  }
};

