import * as path from "path";
import * as process from "process";
import * as child_process from "child_process";
import sanitize from "sanitize-filename";

import moment from "moment";
import * as request from "request-promise";

const FFMPEG = "ffmpeg";
const HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  Origin: "http://hibiki-radio.jp"
};

const APIROOT = "https://vcms-api.hibiki-radio.jp/api/v1/";

const generateFFMpegCmd = (
  filename: string,
  recordedDir: string,
  m3u8_url: string,
  kill_duration: string,
  duration: string
) =>
  // `timeout -k ${kill_duration} ${duration} ${FFMPEG} -i '${m3u8_url}' -c copy -bsf:aac_adtstoasc '${
  `${FFMPEG} -i '${m3u8_url}' -c copy '${path.join(
    recordedDir,
    filename + ".mp4"
  )}' `;

const callAPI = (endpoint: string) =>
  request.default({
    method: "GET",
    uri: APIROOT + endpoint,
    headers: HEADERS,
    json: true
  });

async function fetchVideo(accessId: string, recordedDir: string) {
  const program = await callAPI(`programs/${accessId}`);
  if (!program.episode.video.id) return;
  const videoURL = await callAPI(
    `videos/play_check?video_id=${program.episode.video.id}`
  ).then(resp => resp.playlist_url);
  const updated = moment(
    program.episode_updated_at || program.episode.updated_at,
    "YYYY/MM/DD hh:mm:ss"
  ).format("YYMMDD");
  const epnumber = program.latest_episode_name || program.episode.name;
  const filename = sanitize(
    `${program.episode.program_name}_${epnumber}_${updated}`,
    { replacement: "_" }
  );

  const cmd = generateFFMpegCmd(filename, recordedDir, videoURL, "5h", "1m");
  // await child_process.exec(cmd);
  child_process.execSync(cmd);

  return null;
}

async function main(recordedDir: string) {
  if (recordedDir === undefined) throw Error;
  let page = 0;
  do {
    const programs: any[] = await callAPI("/programs?limit=8&page=" + page);
    if (programs.length <= 0) return;

    programs.forEach(async program =>
      program.update_flg
        ? await fetchVideo(program.access_id, recordedDir)
        : null
    );
    /*
    Promise.map(async program => program.update_flg
          ? await fetchVideo(program.access_id, recordedDir)
          : null
      programs,
    { concurrency: 3 }
    );
    */
    //programs.forEach(async (program: any) => {});
  } while (++page);
}
main(process.argv[2]);
