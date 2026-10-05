export const generateInstagramStoryImage = (quote: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Canvas API not available in server environment"));
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    canvas.width = 1080;
    canvas.height = 1920;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#7264dc");
    gradient.addColorStop(1, "#252341");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxWidth = canvas.width - 120;
    const lineHeight = 80;
    const fontSize = 64;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(" ");
      const lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    const lines = wrapText(`"${quote}"`, maxWidth);
    const totalTextHeight = lines.length * lineHeight;
    const startY = (canvas.height - totalTextHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    ctx.font =
      '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("LumaDiary", canvas.width / 2, canvas.height - 100);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to generate image"));
      }
    }, "image/png");
  });
};

export async function shareQuote(quote: string) {
  const imageBlob = await generateInstagramStoryImage(quote);
  const file = new File([imageBlob], "secondbrain-cita.png", {
    type: "image/png",
  });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Mi cita de LumaDiary", files: [file] });
  } else {
    const url = URL.createObjectURL(imageBlob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
