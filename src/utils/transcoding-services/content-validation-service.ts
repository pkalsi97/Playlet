import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';
import { promisify } from 'util';

interface BasicValidationResult {
    exists: boolean;
    sizeInBytes: number;
    isWithinSizeLimit: boolean;
    containerFormat: string;
    detectedFormats: string;
    videoCodec: string;
    audioCodec: string;
    isValid: boolean;
}

interface StreamValidationResult {
    hasVideoStream: boolean;
    hasAudioStream: boolean;
    isPlayable: boolean;
    hasCorruptFrames: boolean;
    error?: string;
};

export class ContentValidationService {
    private readonly maxSizeInBytes: number;
    private readonly supportedFormats = ['mp4', 'mov', 'avi', 'mkv'];
    private readonly supportedVideoCodecs = ['h264', 'hevc', 'vp8', 'vp9'];
    private readonly supportedAudioCodecs = ['aac', 'mp3', 'opus'];
    private readonly ffprobe: (filePath: string) => Promise<FfprobeData>;

    constructor(maxSizeInBytes: number) {
        this.maxSizeInBytes = maxSizeInBytes;
        this.ffprobe =  promisify(ffmpeg.ffprobe);
    }

    private getDefaultResult(exists: boolean, stats?: fs.Stats): BasicValidationResult {
        return {
            exists,
            sizeInBytes: stats?.size || 0,
            isWithinSizeLimit: stats ? stats.size <= this.maxSizeInBytes : false,
            containerFormat: 'unknown',
            detectedFormats: 'unknown',
            videoCodec: 'none',
            audioCodec: 'none',
            isValid: false
        };
    }

    public async validateBasics(filePath: string): Promise<BasicValidationResult> {
        const stats = await fs.promises.stat(filePath).catch(() => null);
        if (!stats) return this.getDefaultResult(false);

        const metadata = await new Promise<FfprobeData>((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, data) => err ? reject(err) : resolve(data));
        }).catch(() => null);
        
        if (!metadata) return this.getDefaultResult(true, stats);

        const format = path.extname(filePath).toLowerCase().replace('.', '') || 
                      metadata.format?.format_name?.split(',')[0] || 'unknown';

        const videoCodec = metadata.streams.find((s: FfprobeStream) => 
            s.codec_type === 'video')?.codec_name?.toLowerCase() || 'none';
            
        const audioCodec = metadata.streams.find((s: FfprobeStream) => 
            s.codec_type === 'audio')?.codec_name?.toLowerCase() || 'none';

        return {
            exists: true,
            sizeInBytes: stats.size,
            isWithinSizeLimit: stats.size <= this.maxSizeInBytes,
            containerFormat: format,
            detectedFormats: metadata.format?.format_name || 'unknown',
            videoCodec,
            audioCodec,
            isValid: this.isValidVideo(format, videoCodec, audioCodec, stats.size)
        };
    }

    private isValidVideo(format: string, videoCodec: string, audioCodec: string, size: number): boolean {
        return size <= this.maxSizeInBytes &&
               this.supportedFormats.some(f => format.includes(f)) &&
               this.supportedVideoCodecs.includes(videoCodec) &&
               this.supportedAudioCodecs.includes(audioCodec);
    }
    
    public async validateStreams(filePath: string): Promise<StreamValidationResult> {
        const metadata = await this.ffprobe(filePath).catch(() => null);
        if (!metadata) {
            return {
                hasVideoStream: false,
                hasAudioStream: false,
                isPlayable: false,
                hasCorruptFrames: true,
                error: 'Unable to read file metadata'
            };
        }
    
        const videoStream = metadata.streams.find(
            (s: FfprobeStream) => s.codec_type === 'video'
        );
        const audioStream = metadata.streams.find(
            (s: FfprobeStream) => s.codec_type === 'audio'
        );
    
        const playabilityCheck = await this.checkPlayability(filePath);
    
        return {
            hasVideoStream: !!videoStream,
            hasAudioStream: !!audioStream,
            isPlayable: playabilityCheck.isPlayable,
            hasCorruptFrames: !playabilityCheck.isPlayable,
            error: playabilityCheck.error
        };
    }
    
    private async checkPlayability(filePath: string): Promise<{ isPlayable: boolean; error?: string }> {
        const outputPath = process.platform === 'win32' ? 'NUL' : '/dev/null';
        return new Promise((resolve) => {
            ffmpeg()
                .input(filePath)
                .outputOptions(['-f', 'null', '-c', 'copy'])
                .output(outputPath)
                .on('end', () => {
                    resolve({ isPlayable: true });
                })
                .on('error', (error: Error) => {
                    resolve({ 
                        isPlayable: false, 
                        error: error.message 
                    });
                })
                .run();
        });
    }
}




