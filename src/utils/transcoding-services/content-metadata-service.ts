import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';
import { promisify } from 'util';

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}

export interface TechnicalMetadata {
    containerFormat: string;
    videoCodec: string;
    audioCodec: string;
    duration: any;
    bitrate: any;
    frameRate: string | 'N/A';
    resolution: {
        width: number | 'N/A';
        height: number | 'N/A';
    };
    aspectRatio: string | 'N/A';
    colorSpace: string | 'N/A';
}

export interface ContentMetadata {
    creationDate: string | 'N/A';
    lastModified: string | 'N/A';
}

export interface QualityMetrics {
    videoQualityScore: number | 'N/A';
    audioQualityScore: number | 'N/A';
    corruptionStatus: {
        isCorrupted: boolean;
        details: string;
    };
    missingFrames: number | 'N/A';
    audioSync: {
        inSync: boolean;
        offsetMs: number | 'N/A';
    };
}

export class MetadataExtractor {
    private readonly ffprobe: (filePath: string) => Promise<FfprobeData>;

    constructor() {
        this.ffprobe = promisify(ffmpeg.ffprobe);
    }

    public async extractTechnicalMetadata(filePath: string): Promise<TechnicalMetadata> {
        const metadata = await this.ffprobe(filePath).catch(() => null);
        if (!metadata) {
            return this.getDefaultTechnicalMetadata();
        }

        const videoStream = metadata.streams.find(
            (s: FfprobeStream) => s.codec_type === 'video'
        );
        const audioStream = metadata.streams.find(
            (s: FfprobeStream) => s.codec_type === 'audio'
        );

        return {
            containerFormat: metadata.format?.format_name?.split(',')[0] || 'N/A',
            videoCodec: videoStream?.codec_name || 'N/A',
            audioCodec: audioStream?.codec_name || 'N/A',
            duration: metadata.format?.duration ? metadata.format.duration : 0,
            bitrate: metadata.format?.bit_rate ? metadata.format.bit_rate : 0,
            frameRate: videoStream?.r_frame_rate || 'N/A',
            resolution: {
                width: videoStream?.width || 0,
                height: videoStream?.height || 0
            },
            aspectRatio: videoStream?.display_aspect_ratio || 'N/A',
            colorSpace: videoStream?.color_space || 'N/A'
        };
    }

    public async extractContentMetadata(filePath: string): Promise<ContentMetadata> {
        const metadata = await this.ffprobe(filePath).catch(() => null);
        if (!metadata) {
            return this.getDefaultContentMetadata();
        }
    
        const tags = metadata.format?.tags as { creation_time?: string } || {};
        const videoStream = metadata.streams.find(
            (s: FfprobeStream) => s.codec_type === 'video'
        );
    
        return {
            creationDate: tags.creation_time || 'N/A',
            lastModified: await fs.promises.stat(filePath)
                .then(stats => stats.mtime.toISOString())
                .catch(() => 'N/A'),
        };
    }

    public async extractQualityMetrics(filePath: string): Promise<QualityMetrics> {
        const metadata = await this.ffprobe(filePath).catch(() => null);
        if (!metadata) {
            return this.getDefaultQualityMetrics();
        }

        const playabilityCheck = await this.checkPlayability(filePath);

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        return {
            videoQualityScore: this.calculateVideoQuality(videoStream),
            audioQualityScore: this.calculateAudioQuality(audioStream),
            corruptionStatus: {
                isCorrupted: !playabilityCheck.isPlayable,
                details: playabilityCheck.error || 'No corruption detected'
            },
            missingFrames: this.calculateMissingFrames(videoStream),
            audioSync: {
                inSync: true,
                offsetMs: 'N/A'
            }
        };
    }

    private getDefaultTechnicalMetadata(): TechnicalMetadata {
        return {
            containerFormat: 'N/A',
            videoCodec: 'N/A',
            audioCodec: 'N/A',
            duration: 'N/A',
            bitrate: 'N/A',
            frameRate: 'N/A',
            resolution: {
                width: 'N/A',
                height: 'N/A'
            },
            aspectRatio: 'N/A',
            colorSpace: 'N/A'
        };
    }

    private getDefaultContentMetadata(): ContentMetadata {
        return {
            creationDate: 'N/A',
            lastModified: 'N/A',
        };
    }

    private getDefaultQualityMetrics(): QualityMetrics {
        return {
            videoQualityScore: 'N/A',
            audioQualityScore: 'N/A',
            corruptionStatus: {
                isCorrupted: false,
                details: 'Unable to determine'
            },
            missingFrames: 'N/A',
            audioSync: {
                inSync: false,
                offsetMs: 'N/A'
            }
        };
    }

    private async checkPlayability(filePath: string): Promise<{ isPlayable: boolean; error?: string }> {
        return new Promise((resolve) => {
            const outputPath = process.platform === 'win32' ? 'NUL' : '/dev/null';
            ffmpeg()
                .input(filePath)
                .outputOptions(['-f', 'null', '-c', 'copy'])
                .output(outputPath)
                .on('end', () => resolve({ isPlayable: true }))
                .on('error', (error: Error) => resolve({ 
                    isPlayable: false, 
                    error: error.message 
                }))
                .run();
        });
    }

    private calculateVideoQuality(videoStream?: FfprobeStream): number | 'N/A' {
        if (!videoStream) return 'N/A';

        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const bitrate = parseInt(videoStream.bit_rate || '0');

        if (!width || !height || !bitrate) return 'N/A';

        const resolutionScore = (width * height) / (1920 * 1080);
        const bitrateScore = bitrate / 5000000;
        
        return Math.min(100, Math.round((resolutionScore + bitrateScore) * 50));
    }

    private calculateAudioQuality(audioStream?: FfprobeStream): number | 'N/A' {
        if (!audioStream) return 'N/A';

        const bitrate = parseInt(audioStream.bit_rate || '0');
        if (!bitrate) return 'N/A';

        return Math.min(100, Math.round((bitrate / 320000) * 100));
    }

    private calculateMissingFrames(videoStream?: FfprobeStream): number | 'N/A' {
        if (!videoStream) return 'N/A';

        const expectedFrames = videoStream.duration && videoStream.r_frame_rate
            ? this.calculateExpectedFrames(
                parseFloat(videoStream.duration), 
                videoStream.r_frame_rate
              )
            : 0;
        const actualFrames = videoStream.nb_frames 
            ? parseInt(videoStream.nb_frames) 
            : 0;

        return expectedFrames && actualFrames 
            ? Math.max(0, expectedFrames - actualFrames)
            : 'N/A';
    }

    private calculateExpectedFrames(duration: number, frameRate: string): number {
        const [num, den] = frameRate.split('/').map(Number);
        return Math.round(duration * (num / den));
    }
}