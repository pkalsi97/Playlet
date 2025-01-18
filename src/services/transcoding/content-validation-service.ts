import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';
import { promisify } from 'util';

import {
    BasicValidationResult,
    StreamValidationResult,
    ContentValidationResult,
} from '../../types/metadata.types'

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}

export class ContentValidationService {
    private readonly supportedFormats = ['mp4', 'mov', 'avi', 'mkv'];
    private readonly supportedVideoCodecs = ['h264', 'hevc', 'vp8', 'vp9'];
    private readonly supportedAudioCodecs = ['aac', 'mp3', 'opus'];
    private readonly ffprobe: (filePath: string) => Promise<FfprobeData>;

    constructor() {
        this.ffprobe =  promisify(ffmpeg.ffprobe);
    }

    public async  validateContent(filePath:string): Promise <ContentValidationResult> {

        const basic = await this.validateBasics(filePath);
        if (!basic.isValid) {
            return {
                success: false,
                error: "Invalid format or codecs",
                basic,
                stream: {
                    hasVideoStream: false,
                    hasAudioStream: false,
                    isPlayable: false,
                    hasCorruptFrames: false
                }
            };
        };

        const stream: StreamValidationResult = await this.validateStreams(filePath);

        const success = basic.isValid && 
                   stream.isPlayable && 
                   !stream.hasCorruptFrames &&
                   stream.hasVideoStream &&
                   stream.hasAudioStream;

        let error: string | undefined;
        if (!success) {
            if (!stream.hasVideoStream) error = "No video stream found";
            else if (!stream.hasAudioStream) error = "No audio stream found";
            else if (stream.hasCorruptFrames) error = "Corrupt frames detected";
            else if (!stream.isPlayable) error = stream.error || "Content not playable";
            else error = "Validation failed";
        }

        return{
            success,
            error,
            basic,
            stream
        }
    };

    private getDefaultResult(exists: boolean, stats?: fs.Stats): BasicValidationResult {
        return {
            exists,
            sizeInBytes: stats?.size || 0,
            containerFormat: 'unknown',
            detectedFormats: 'unknown',
            videoCodec: 'none',
            audioCodec: 'none',
            isValid: false
        };
    }

    private async validateBasics(filePath: string): Promise<BasicValidationResult> {
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
            containerFormat: format,
            detectedFormats: metadata.format?.format_name || 'unknown',
            videoCodec,
            audioCodec,
            isValid: this.isValidVideo(format, videoCodec, audioCodec, stats.size)
        };
    }

    private isValidVideo(format: string, videoCodec: string, audioCodec: string, size: number): boolean {
        return this.supportedFormats.some(f => format.includes(f)) &&
               this.supportedVideoCodecs.includes(videoCodec) &&
               this.supportedAudioCodecs.includes(audioCodec);
    }
    
    private async validateStreams(filePath: string): Promise<StreamValidationResult> {
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




