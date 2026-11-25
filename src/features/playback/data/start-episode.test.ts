import { chooseStartEpisode } from './start-episode';

const local = (index: number) => index * 10 + 1;
const base = { episodeCount: 5, localProgress: local };

describe('chooseStartEpisode', () => {
  test('no record and nothing requested: first episode with its local progress', () => {
    expect(chooseStartEpisode({ ...base })).toEqual({
      index: 0,
      resumeTime: 1,
    });
  });

  test('a play record resumes its episode and time', () => {
    expect(
      chooseStartEpisode({ ...base, record: { index: 3, play_time: 120 } })
    ).toEqual({ index: 2, resumeTime: 120 });
  });

  test('a requested episode beats the record; same episode keeps the record time', () => {
    expect(
      chooseStartEpisode({
        ...base,
        record: { index: 3, play_time: 120 },
        requestedIndex: 2,
      })
    ).toEqual({ index: 2, resumeTime: 120 });
    expect(
      chooseStartEpisode({
        ...base,
        record: { index: 3, play_time: 120 },
        requestedIndex: 4,
      })
    ).toEqual({ index: 4, resumeTime: 41 });
  });

  test('a requested episode past the end is clamped', () => {
    expect(chooseStartEpisode({ ...base, requestedIndex: 9 })).toEqual({
      index: 4,
      resumeTime: 41,
    });
  });

  test('the detail start index is used when nothing is requested', () => {
    expect(chooseStartEpisode({ ...base, detailInitialIndex: 1 })).toEqual({
      index: 1,
      resumeTime: 11,
    });
  });
});
