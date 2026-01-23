import { spawn } from 'child_process';
import { unlink, rename } from 'fs/promises';

/**
 * Normalize audio file to -16 LUFS using ffmpeg.
 * This matches the normalization done in the Python import scripts.
 *
 * @param filePath Absolute path to the audio file
 * @returns Promise that resolves when normalization is complete
 */
export async function normalizeAudioFile(filePath: string): Promise<void> {
  const tempOutput = filePath.replace(/\.mp3$/, '.normalized.mp3');

  return new Promise((resolve, reject) => {
    // ffmpeg command to normalize to -16 LUFS (EBU R128 standard)
    const ffmpegArgs = [
      '-i', filePath,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',  // EBU R128 loudness normalization
      '-ar', '44100',                           // Sample rate
      '-b:a', '192k',                          // Audio bitrate
      '-y',                                     // Overwrite output
      tempOutput
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        console.error('FFmpeg normalization failed:', stderr);
        // Clean up temp file if it exists
        try {
          await unlink(tempOutput);
        } catch (e) {
          // Ignore error if temp file doesn't exist
        }
        reject(new Error(`FFmpeg exited with code ${code}`));
        return;
      }

      try {
        // Replace original with normalized version
        await rename(tempOutput, filePath);
        console.log('Audio normalized to -16 LUFS:', filePath);
        resolve();
      } catch (error) {
        console.error('Error replacing normalized file:', error);
        reject(error);
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('FFmpeg spawn error:', error);
      reject(error);
    });
  });
}
