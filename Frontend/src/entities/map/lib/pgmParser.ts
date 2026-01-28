/**
 * PGM (Portable Gray Map) Parser for Web
 * Supports P2 (ASCII) and P5 (Binary) formats.
 */

export interface PGMData {
    width: number;
    height: number;
    maxVal: number;
    data: Uint8Array;
}
  
  /**
   * Parses a PGM file buffer into raw image data.
   */
  export function parsePGM(buffer: ArrayBuffer): PGMData {
    const view = new DataView(buffer);
    let offset = 0;

    // Helper: Consume whitespace and return next non-whitespace token
    const getNextToken = (): string | null => {
      let token = '';
      
      // 1. Consume any leading whitespace or comments
      while (offset < buffer.byteLength) {
          const code = view.getUint8(offset);
          const char = String.fromCharCode(code);

          if (char === '#') {
              // Comment: Consume until newline
              while (offset < buffer.byteLength && String.fromCharCode(view.getUint8(offset)) !== '\n') {
                  offset++;
              }
              // Consume the newline itself if present
              if (offset < buffer.byteLength) offset++;
              continue; // Check for more whitespace/comments
          }

          if (/\s/.test(char)) {
              offset++;
              continue;
          }
          
          break; // Found start of token
      }

      if (offset >= buffer.byteLength) return null;

      // 2. Read Token
      while (offset < buffer.byteLength) {
          const code = view.getUint8(offset);
          const char = String.fromCharCode(code);

          // Stop at whitespace or comment start
          if (/\s/.test(char) || char === '#') {
              break;
          }
          token += char;
          offset++;
      }
      return token;
    };
  
    const magicNumber = getNextToken();
    if (magicNumber !== 'P2' && magicNumber !== 'P5') {
      throw new Error(`Unsupported PGM format: ${magicNumber}`);
    }
  
    const widthStr = getNextToken();
    const heightStr = getNextToken();
    const maxValStr = getNextToken();

    if (!widthStr || !heightStr || !maxValStr) {
        throw new Error("Invalid PGM Header: Missing dimensions or maxVal");
    }

    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);
    const maxVal = parseInt(maxValStr, 10);
    
    const pixelCount = width * height;
    const data = new Uint8Array(pixelCount);
  
    if (magicNumber === 'P5') {
      // Binary Format (P5)
      // "A single whitespace character (usually a newline) separates the maxval from the raster."
      // getNextToken stopped AT the whitespace/comment start after maxVal.
      // We need to consume exactly ONE whitespace character if it exists, 
      // OR if we hit a comment, handle it (but PGM spec says single whitespace usually).
      
      // Robust Logic: The standard says "single whitespace".
      // But `getNextToken` might have left us sitting ON that whitespace.
      if (offset < buffer.byteLength && /\s/.test(String.fromCharCode(view.getUint8(offset)))) {
          offset++; // Consume the single separator
      }

      // Now offset should be at the start of binary data
      if (offset + pixelCount > buffer.byteLength) {
          console.warn(`[PGM] Expected ${pixelCount} bytes but only ${buffer.byteLength - offset} remain. Truncated?`);
      }
      
      const binaryData = new Uint8Array(buffer, offset, Math.min(pixelCount, buffer.byteLength - offset));
      data.set(binaryData);
    } else {
      // ASCII Format (P2)
      for (let i = 0; i < pixelCount; i++) {
        const valToken = getNextToken();
        if (valToken) {
            data[i] = parseInt(valToken, 10);
        }
      }
    }
  
    // Debug: Analyze Data Distribution
    let min = 255;
    let max = 0;
    let nonZeros = 0;
    const uniqueValues = new Set();
    
    // Sample first 1000 pixels or all
    const sampleSize = Math.min(pixelCount, 10000);
    for(let i=0; i<pixelCount; i++) {
        const val = data[i];
        if (val !== undefined) {
            if (val < min) min = val;
            if (val > max) max = val;
            if (val > 0) nonZeros++;
        }
    }
    
    console.log(`[PGM Parser] Parsed ${width}x${height} (Total: ${pixelCount}px)`);
    console.log(`[PGM Parser] Data Stats -> Min: ${min}, Max: ${max}, Non-Zeros: ${nonZeros}`);
    console.log(`[PGM Parser] MaxVal Header: ${maxVal}`);
    console.log(`[PGM Parser] Unique Val Sample:`, Array.from(uniqueValues));

    return { width, height, maxVal, data };
  }
  
  /**
   * Converts parsed PGM data to an ImageData object for Canvas.
   */
  export function pgmToImageData(pgm: PGMData): ImageData {
    const { width, height, data } = pgm;
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
      let raw = data[i] ?? 0;
      // Normalize to 0-255 based on maxVal
      // If maxVal is 1 (binary map), 1 becomes 255 (White), 0 becomes 0 (Black)
      // If maxVal is 255, it stays as is.
      const gray = pgm.maxVal > 0 ? Math.floor((raw / pgm.maxVal) * 255) : raw;
      
      const idx = i * 4;
      rgbaData[idx] = gray;     // R
      rgbaData[idx + 1] = gray; // G
      rgbaData[idx + 2] = gray; // B
      rgbaData[idx + 3] = 255;  // Alpha
    }
    
    return new ImageData(rgbaData, width, height);
  }

  /**
   * Loads a PGM file from URL and returns an ImageBitmap ready for Canvas.
   */
  export async function loadPGM(url: string): Promise<ImageBitmap> {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const pgmData = parsePGM(buffer);
      const imageData = pgmToImageData(pgmData);
      return createImageBitmap(imageData);
  }
