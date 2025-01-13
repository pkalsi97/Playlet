import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

export interface GopConfig {
    keyframeInterval: number;
    forceClosedGop: boolean;
    sceneChangeDetection: boolean;
    outputDir: string;
    frameRate?: number;
    preset?: string;
    crf?: number;           
}

export interface GopSegment {
    sequence: number;
    path: string;
}

export interface GopResult {
    success: boolean;
    error?: string;
    timeTaken: number;
    segments: GopSegment[];
}

export class GopCreator {
    private readonly config: GopConfig;

    constructor(config: GopConfig) {
        this.config = {
            keyframeInterval: config.keyframeInterval || 2,
            forceClosedGop: config.forceClosedGop ?? true,
            sceneChangeDetection: config.sceneChangeDetection ?? false,
            outputDir: config.outputDir,
            frameRate: config.frameRate || 30,
            preset: config.preset || 'fast',
            crf: config.crf || 18
        };
    }

    private getGopOptions(): string[] {
        return [
            // Video codec and quality settings
            '-c:v', 'libx264',
            '-preset', `${this.config.preset}`,
            '-crf', `${this.config.crf}`,
            '-c:a', 'copy',
            
            // Frame rate
            '-r', `${this.config.frameRate}`,
            
            // GOP settings
            '-g', `${this.config.keyframeInterval * this.config.frameRate!}`,
            '-keyint_min', `${this.config.keyframeInterval * this.config.frameRate!}`,
            '-force_key_frames', `expr:gte(t,n_forced*${this.config.keyframeInterval})`,
            
            // Closed GOP setting
            ...(this.config.forceClosedGop ? ['-flags', '+cgop'] : []),
            
            // Scene change detection
            ...(this.config.sceneChangeDetection ? ['-sc_threshold', '1'] : ['-sc_threshold', '0']),
            
            // Segmentation
            '-f', 'segment',
            '-segment_time', `${this.config.keyframeInterval}`,
            '-reset_timestamps', '1',
            '-segment_format', 'mp4'
        ].filter(Boolean);
    }
    public async createGopSegments(inputPath: string): Promise<GopResult> {
        const startTime = Date.now();

        try {
            await fs.promises.mkdir(this.config.outputDir, { recursive: true });
            await this.executeFFmpeg(inputPath);

            const files = await fs.promises.readdir(this.config.outputDir);
            const segments: GopSegment[] = files
                .filter(file => file.endsWith('.mp4'))
                .sort()
                .map((file, index) => ({
                    sequence: index,
                    path: path.join(this.config.outputDir, file)
                }));

            return {
                success: true,
                timeTaken: (Date.now() - startTime) / 1000,
                segments
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                timeTaken: (Date.now() - startTime) / 1000,
                segments: []
            };
        }
    }
    
    private async executeFFmpeg(inputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions(this.getGopOptions())
                .output(path.join(this.config.outputDir, 'segment_%03d.mp4'))
                .on('end', () => resolve())
                .on('error', reject)
                .run();
        });
    }
}