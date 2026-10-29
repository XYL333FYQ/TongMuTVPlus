import { fireEvent, render, screen } from '@testing-library/react';

import {
  addMusicSongToPlaylist,
  playMusicLater,
  playMusicSong,
} from '@/lib/music/actions';
import type { Song } from '@/lib/music/types';

import SongList from './SongList';

jest.mock('@/lib/music/actions', () => ({
  addMusicSongToPlaylist: jest.fn(),
  playMusicLater: jest.fn(),
  playMusicSong: jest.fn(),
}));
jest.mock('@/lib/music/now-playing', () => ({
  useNowPlaying: () => null,
  songKey: () => 'song',
}));

const song = { id: '1', name: '歌曲', artist: '歌手', platform: 'wy' } as Song;

test('song playback and secondary actions are separate native buttons', () => {
  render(<SongList songs={[song]} />);
  const play = screen.getByRole('button', { name: '播放 歌曲，歌手' });
  const later = screen.getByRole('button', { name: '稍后播放' });
  expect(play.tagName).toBe('BUTTON');
  expect(play).not.toContainElement(later);
  fireEvent.keyDown(later, { key: 'Enter' });
  fireEvent.click(later);
  expect(playMusicLater).toHaveBeenCalledWith(song);
  expect(playMusicSong).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '添加到歌单' }));
  expect(addMusicSongToPlaylist).toHaveBeenCalledWith(song);
  fireEvent.click(play);
  expect(playMusicSong).toHaveBeenCalledWith(song, 0);
});
