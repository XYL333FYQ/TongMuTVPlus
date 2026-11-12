/** @jest-environment ./src/test/node-web-environment.cjs */
import { getDetailFromApiV2 } from './downstream';

test('strict room resolution rejects another film while legacy callers keep their existing contract', async () => {
  const previous = global.fetch;
  global.fetch = jest.fn(
    async () =>
      new Response(
        JSON.stringify({
          list: [
            {
              vod_id: 'wrong-film',
              vod_name: 'Wrong',
              vod_pic: '',
              vod_play_url: 'Episode 1$https://media.test/one.mp4',
            },
          ],
        })
      )
  );
  const site = {
    key: 'fixture',
    name: 'Fixture',
    api: 'https://catalog.test/api',
  };
  try {
    await expect(
      getDetailFromApiV2(site, 'expected-film', { requireExactId: true })
    ).rejects.toThrow(/ID/);
    expect((await getDetailFromApiV2(site, 'expected-film')).id).toBe(
      'expected-film'
    );
  } finally {
    global.fetch = previous;
  }
});
