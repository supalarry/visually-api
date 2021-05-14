import { createClient, Videos, Video, ErrorResponse } from 'pexels';
import { Transcription } from '../services/watson';
import logging from '../config/logging';
const client = createClient(process.env.PEXELS_API_KEY!);

const NAMESPACE = 'pexelsFetcher';

async function fetchVideosForSearchTerm(query: string | undefined): Promise<Video[]> {
    let video: Video[];
    if (!query) {
        logging.error(NAMESPACE, `Fetching falsey value to fetchVideo is not allowed`);
        throw new Error('Fetching falsey value to fetchVideo is not allowed');
    }
    try {
        logging.info(NAMESPACE, `Fetching videos for: "${query}"`);
        const videos: Videos | ErrorResponse = await client.videos.search({ query, per_page: 10 });
        if (!(videos as ErrorResponse).error) {
            video = (videos as Videos).videos;
            return video;
        } else {
            throw new Error((videos as ErrorResponse).error);
        }
    } catch (error) {
        logging.error(NAMESPACE, `Failed fetching video "${query}"`);
        logging.error(NAMESPACE, `Fetching failure reason: ${error.message}`, error);
        throw new Error(error.message);
    }
}

async function fetchVideos(transcription: Transcription) {
    logging.info(NAMESPACE, 'Start fetching videos');
    for (let sentence of transcription.sentences) {
        const selectedVideos: Video[] = [];
        let fetchingAttempts = 0;
        do {
            const fetchedVideos = await fetchVideosForSearchTerm(sentence.analysis.rank?.[fetchingAttempts].text);
            // check if search term returned any videos
            if (!fetchVideos.length) {
                // if not, fetch again
                fetchingAttempts += 1;
                continue;
            }
            logging.info(NAMESPACE, `Fetched ${fetchedVideos.length} videos`);
            // check how many videos to include based on sentence duration
            let selectedVideoDuration = 0;
            for (let video of fetchedVideos) {
                if (selectedVideoDuration < sentence.duration) {
                    selectedVideos.push(video);
                    selectedVideoDuration += video.duration;
                } else {
                    // trim last video to match sentence length
                    selectedVideos[selectedVideos.length - 1].duration -= selectedVideoDuration - sentence.duration;
                    break;
                }
            }
            // if fetched video duration is shorter than sentence duration, then fetch next search query
            if (selectedVideoDuration < sentence.duration) {
                fetchingAttempts += 1;
                continue;
            }
            // note the selected item for which videos were fetched
            sentence.analysis.fetchedVideoFor = sentence.analysis.rank?.[fetchingAttempts];
            logging.info(NAMESPACE, `Chose ${selectedVideos.length} video/s`);
            fetchingAttempts = 0;
        } while (!selectedVideos.length);

        sentence.videos = selectedVideos;
    }
    logging.info(NAMESPACE, 'Finished fetching videos');
}

export { fetchVideos };
