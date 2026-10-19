/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';

interface Song {
  id: string;
  name: string;
  artist: string;
  album?: string;
  pic?: string;
  platform: 'wy' | 'tx' | 'kw' | 'kg' | 'mg';
  duration?: number;
}

interface MusicPlaylist {
  id: string;
  username: string;
  name: string;
  description?: string;
  cover?: string;
  created_at: number;
  updated_at: number;
}

interface AddToPlaylistModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function MusicLoadingIndicator({
  text,
  size = 'md',
  className = '',
}: {
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-[13px]' : 'text-sm';

  return (
    <>
      <style jsx>{`
        @keyframes music-note-bounce {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
      <div
        className={`flex items-center justify-center gap-3 text-muted ${className}`}
      >
        <div className='flex items-end gap-1.5'>
          {[0, 1, 2].map((index) => (
            <svg
              key={index}
              className={`${iconSize} text-fg`}
              fill='currentColor'
              viewBox='0 0 24 24'
              style={{
                animation: `music-note-bounce 0.9s ease-in-out ${
                  index * 0.14
                }s infinite`,
              }}
            >
              <path d='M12 3v11.55A3.98 3.98 0 0010 14c-2.21 0-4 1.34-4 3s1.79 3 4 3 4-1.34 4-3V8h4V3h-6z' />
            </svg>
          ))}
        </div>
        {text ? (
          <span className={`${textSize} font-medium tracking-wide`}>
            {text}
          </span>
        ) : null}
      </div>
    </>
  );
}

export default function AddToPlaylistModal({
  song,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingToPlaylistId, setAddingToPlaylistId] = useState<string | null>(
    null
  ); // 正在添加的歌单ID

  // 加载用户的歌单列表
  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
    }
  }, [isOpen]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/music/v2/playlists');
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.data?.playlists || []);
      }
    } catch (error) {
      console.error('加载歌单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      onError?.('请输入歌单名称');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/music/v2/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          description: newPlaylistDescription.trim(),
        }),
      });

      if (response.ok) {
        setNewPlaylistName('');
        setNewPlaylistDescription('');
        setShowCreateForm(false);
        await loadPlaylists();
      } else {
        const data = await response.json();
        onError?.(getApiErrorMessage(data.error, '创建歌单失败'));
      }
    } catch (error) {
      console.error('创建歌单失败:', error);
      onError?.('创建歌单失败');
    } finally {
      setCreating(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!song) return;

    try {
      setAddingToPlaylistId(playlistId);
      const response = await fetch(
        `/api/music/v2/playlists/${playlistId}/songs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            song: {
              source: song.platform,
              songId: song.id,
              name: song.name,
              artist: song.artist,
              album: song.album,
              cover: song.pic,
              durationSec: song.duration || 0,
            },
          }),
        }
      );

      if (response.ok) {
        onSuccess?.();
        onClose();
      } else {
        const data = await response.json();
        onError?.(getApiErrorMessage(data.error, '添加失败'));
      }
    } catch (error) {
      console.error('添加到歌单失败:', error);
      onError?.('添加到歌单失败');
    } finally {
      setAddingToPlaylistId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 bg-ink/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4'
      onClick={onClose}
    >
      <div
        className='bg-surface rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden border border-line'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='p-4 border-b border-line'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-bold text-fg'>添加到歌单</h3>
            <button
              onClick={onClose}
              className='text-muted hover:text-fg transition-colors min-h-[44px] tm-press'
            >
              <svg
                className='w-6 h-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
          {song && (
            <div className='mt-2 text-sm text-muted'>
              {song.name} - {song.artist}
            </div>
          )}
        </div>

        {/* Content */}
        <div className='p-4 overflow-y-auto max-h-[calc(80vh-120px)]'>
          {/* Create New Playlist Button */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className='w-full mb-4 px-4 py-3 bg-fg hover:opacity-90 text-inverse rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] tm-press'
            >
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 4v16m8-8H4'
                />
              </svg>
              创建新歌单
            </button>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className='mb-4 p-4 bg-raised rounded-lg border border-line'>
              <input
                type='text'
                placeholder='歌单名称'
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className='w-full px-3 py-2 bg-surface text-fg rounded-lg border border-line focus:border-line focus:outline-none mb-2'
              />
              <textarea
                placeholder='歌单描述（可选）'
                value={newPlaylistDescription}
                onChange={(e) => setNewPlaylistDescription(e.target.value)}
                className='w-full px-3 py-2 bg-surface text-fg rounded-lg border border-line focus:border-line focus:outline-none resize-none'
                rows={2}
              />
              <div className='flex gap-2 mt-2'>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={creating}
                  className='flex-1 px-4 py-2 bg-fg hover:opacity-90 disabled:bg-surface text-inverse rounded-lg transition-colors flex items-center justify-center min-h-[44px] tm-press'
                >
                  {creating ? (
                    <MusicLoadingIndicator
                      size='sm'
                      className='gap-2 text-fg'
                    />
                  ) : (
                    '确定'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPlaylistName('');
                    setNewPlaylistDescription('');
                  }}
                  className='flex-1 px-4 py-2 bg-surface hover:bg-line text-fg rounded-lg transition-colors min-h-[44px] tm-press'
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* Playlists List */}
          {loading ? (
            <MusicLoadingIndicator className='py-8' />
          ) : playlists.length === 0 ? (
            <div className='text-center py-8 text-muted'>
              还没有歌单，创建一个吧
            </div>
          ) : (
            <div className='space-y-2'>
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={addingToPlaylistId !== null}
                  className='w-full px-4 py-3 bg-raised hover:bg-line disabled:bg-raised disabled:cursor-not-allowed rounded-lg transition-colors text-left flex items-center gap-3 min-h-[44px] tm-press'
                >
                  {playlist.cover ? (
                    <img
                      src={playlist.cover}
                      alt={playlist.name}
                      className='w-12 h-12 rounded object-cover'
                    />
                  ) : (
                    <div className='w-12 h-12 rounded bg-surface flex items-center justify-center'>
                      <svg
                        className='w-6 h-6 text-muted'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3'
                        />
                      </svg>
                    </div>
                  )}
                  <div className='flex-1 min-w-0'>
                    <div className='text-fg font-medium truncate'>
                      {playlist.name}
                    </div>
                    {playlist.description && (
                      <div className='text-[13px] text-muted truncate'>
                        {playlist.description}
                      </div>
                    )}
                  </div>
                  {addingToPlaylistId === playlist.id ? (
                    <MusicLoadingIndicator size='sm' className='gap-1' />
                  ) : (
                    <svg
                      className='w-5 h-5 text-muted'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9 5l7 7-7 7'
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
