'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SearchResult } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import PageContainer from '@/components/PageContainer';
import PageHeader from '@/components/PageHeader';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

interface ScriptSourceOption {
  key: string;
  name: string;
  description?: string;
}

export default function AdvancedRecommendationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const initialUrlSourceRef = useRef(searchParams.get('source') || '');

  const [sources, setSources] = useState<ScriptSourceOption[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [videos, setVideos] = useState<SearchResult[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const initializedRef = useRef(false);
  const hasSyncedUrlRef = useRef(false);

  useEffect(() => {
    const fetchSources = async () => {
      setIsLoadingSources(true);
      try {
        const response = await fetch('/api/advanced-recommendation/sources');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '获取脚本源失败');
        }

        const nextSources: ScriptSourceOption[] = Array.isArray(data.sources)
          ? data.sources
          : [];
        setSources(nextSources);

        const initialSource =
          nextSources.find((item) => item.key === initialUrlSourceRef.current)
            ?.key ||
          nextSources[0]?.key ||
          '';

        setSelectedSource(initialSource);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取脚本源失败');
      } finally {
        setIsLoadingSources(false);
        initializedRef.current = true;
      }
    };

    fetchSources();
  }, []);

  useEffect(() => {
    if (!initializedRef.current || !selectedSource) return;
    if (!hasSyncedUrlRef.current) {
      hasSyncedUrlRef.current = true;
      if (initialUrlSourceRef.current === selectedSource) return;
    }

    const params = new URLSearchParams();
    params.set('source', selectedSource);
    router.replace(`/advanced-recommendation?${params.toString()}`, {
      scroll: false,
    });
  }, [selectedSource, router]);

  useEffect(() => {
    if (!selectedSource) return;

    setVideos([]);
    setPage(1);
    setHasMore(true);
    setError('');
  }, [selectedSource]);

  useEffect(() => {
    if (!selectedSource) return;

    const fetchVideos = async () => {
      setIsLoadingVideos(true);
      try {
        const response = await fetch(
          `/api/advanced-recommendation/videos?source=${encodeURIComponent(
            selectedSource
          )}&page=${page}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '获取推荐失败');
        }

        const nextResults = Array.isArray(data.results) ? data.results : [];
        setVideos((prev) =>
          page === 1 ? nextResults : [...prev, ...nextResults]
        );
        setHasMore(Number(data.page || page) < Number(data.pageCount || 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取推荐失败');
        setHasMore(false);
      } finally {
        setIsLoadingVideos(false);
      }
    };

    fetchVideos();
  }, [selectedSource, page]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoadingVideos || !!error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [error, hasMore, isLoadingVideos]);

  return (
    <PageLayout activePath='/advanced-recommendation'>
      <PageContainer className='pb-12'>
        <PageHeader title='高级推荐' description='选择来源，查看推荐影片' />

        <div className='space-y-6'>
          <div>
            <span className='tm-field-label'>来源</span>
            {isLoadingSources ? (
              <div role='status' className='tm-inline-state'>
                正在加载来源
              </div>
            ) : sources.length === 0 ? (
              <div className='tm-inline-state'>还没有可用的视频源脚本</div>
            ) : (
              <div className='flex'>
                <CapsuleSwitch
                  options={sources.map((item) => ({
                    label: item.name,
                    value: item.key,
                  }))}
                  active={selectedSource}
                  onChange={setSelectedSource}
                />
              </div>
            )}
          </div>

          {!!error && (
            <div role='alert' className='text-sm text-danger'>
              {error}
            </div>
          )}

          {!isLoadingSources && sources.length > 0 && (
            <>
              {videos.length > 0 ? (
                <div className='tm-poster-grid'>
                  {videos.map((video, index) => (
                    <VideoCard
                      key={`${video.source}-${video.id}-${index}`}
                      id={video.id}
                      source={video.source}
                      source_name={video.source_name}
                      title={video.title}
                      poster={video.poster}
                      year={video.year}
                      rate={
                        typeof video.rating === 'number'
                          ? String(video.rating)
                          : undefined
                      }
                      douban_id={video.douban_id}
                      tmdb_id={video.tmdb_id}
                      from='source-search'
                    />
                  ))}
                </div>
              ) : !isLoadingVideos && !error ? (
                <div className='tm-empty'>
                  <p className='tm-empty-title'>这个来源暂时没有推荐</p>
                </div>
              ) : null}

              {isLoadingVideos && (
                <div
                  role='status'
                  aria-label='正在加载推荐'
                  className='tm-poster-grid'
                >
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className='tm-poster tm-skeleton' />
                  ))}
                </div>
              )}

              <div ref={loadMoreRef} className='h-10' />
            </>
          )}
        </div>
      </PageContainer>
    </PageLayout>
  );
}
