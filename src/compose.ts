export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não carregou ${src}`));
    img.src = src;
  });
}

/** Empilha camadas com o mesmo layout de quadros numa imagem só (para o Phaser e o preview). */
export async function composeLayers(urls: string[]): Promise<HTMLImageElement> {
  const imgs = await Promise.all(urls.map(loadImage));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...imgs.map(i => i.width));
  canvas.height = Math.max(...imgs.map(i => i.height));
  const ctx = canvas.getContext('2d')!;
  for (const img of imgs) ctx.drawImage(img, 0, 0);
  return loadImage(canvas.toDataURL());
}
