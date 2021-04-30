import { Video } from 'pexels';
import axios from 'axios';
import logging from '../config/logging';

const NAMESPACE = 'Shotstack Editor';
const RENDER_ENDPOINT = '/render/';

// Interfaces for Shotstack request
interface Edit {
    timeline: Timeline;
    output: Output;
}

interface Output {
    format: string;
    resolution: string;
}

interface Timeline {
    tracks: Track[];
}

interface Track {
    clips: Asset[];
}

interface Asset {
    asset: {
        type: string;
        src: string;
        text?: string;
        style?: string;
        size?: string;
        trim?: number;
    };
    start: number;
    length: number;
    effect?: string;
    transition?: {
        in: string;
        out: string;
    };
}

// Interface of Shotstack response
interface ShotstackResponse {
    success: boolean;
    message: string;
    response: {
        message: string;
        id: string;
    };
}

async function submitVideosForRendering(videos: Video[]): Promise<ShotstackResponse> {
    logging.info(NAMESPACE, 'Submitting videos for rendering');
    // set up timeline
    const clips: Asset[] = extractVideoAssets(videos);
    const track: Track = { clips };
    const tracks: Track[] = [];
    tracks.push(track);
    const timeline: Timeline = { tracks };
    // set up output
    const output: Output = { format: 'mp4', resolution: 'sd' };
    // combine timeline & output into final object
    const edit: Edit = { timeline, output };
    // call video editing API
    try {
        const response = await axios.post(`${process.env.SHOTSTACK_API_URL!}${RENDER_ENDPOINT}`, edit, {
            headers: {
                'x-api-key': process.env.SHOTSTACK_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        const data: ShotstackResponse = response.data;
        return data;
    } catch (error) {
        logging.error(NAMESPACE, 'Failed submitting videos for rendering');
        throw new Error(error.message);
    }
}

function extractVideoAssets(videos: Video[]): Asset[] {
    let videosFiles: Asset[] = [];
    let mergedVideoLength = 0;
    let currentVideoIndex = 0;
    for (let video of videos) {
        videosFiles[currentVideoIndex] = {
            asset: {
                type: 'video',
                src: video.video_files[0].link
            },
            start: mergedVideoLength,
            length: video.duration
        };
        mergedVideoLength += video.duration;
        currentVideoIndex += 1;
    }
    return videosFiles;
}

async function pollShotstackForRenderedVideo(response: ShotstackResponse): Promise<string> {
    const videoId = response.response.id;
    const nextResponse = await axios.get(`${process.env.SHOTSTACK_API_URL!}${RENDER_ENDPOINT}${videoId}`, {
        headers: {
            'x-api-key': process.env.SHOTSTACK_API_KEY,
            'Content-Type': 'application/json'
        }
    });
    if (nextResponse.data.response.status === 'done') {
        logging.info(NAMESPACE, `Succeeded: ${nextResponse.data.response.url}`);
        return nextResponse.data.response.url;
    } else if (nextResponse.data.response.status === 'failed') {
        logging.info(NAMESPACE, `Failed with the following error: ${nextResponse.data.response.error}`);
        throw new Error(`Failed with the following error: ${nextResponse.data.response.error}`);
    } else {
        setTimeout(async () => {}, 3000);
        logging.info(NAMESPACE, `Fetching again. Current ShotstrackAPI status is ${nextResponse.data.response.status}...`);
        return await pollShotstackForRenderedVideo(response);
    }
}

export { submitVideosForRendering, pollShotstackForRenderedVideo, ShotstackResponse };
