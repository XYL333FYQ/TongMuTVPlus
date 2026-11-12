// Generated from SyncTV Server v1.0.14 / App v1.1.32; DO NOT EDIT.
// Upstream license: vendor/synctv/LICENSE. Regenerate: pnpm gen:synctv.
import * as $protobuf from "protobufjs";
type Long = $protobuf.Long;
export namespace synctv {

    namespace client {

        enum ChatAttachmentReferenceKind {
            CHAT_ATTACHMENT_REFERENCE_KIND_UNSPECIFIED = 0,
            CHAT_ATTACHMENT_REFERENCE_KIND_UPLOAD = 1,
            CHAT_ATTACHMENT_REFERENCE_KIND_REUSE = 2
        }

        interface IChatAttachmentReference {
            id?: (string|null);
            kind?: (synctv.client.ChatAttachmentReferenceKind|null);
        }

        class ChatAttachmentReference implements IChatAttachmentReference {
            constructor(properties?: synctv.client.IChatAttachmentReference);
            public id: string;
            public kind: synctv.client.ChatAttachmentReferenceKind;
            public static encode(message: synctv.client.IChatAttachmentReference, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatAttachmentReference;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatPresentationMetadata {
            displayPosition?: (string|null);
            displayColor?: (string|null);
        }

        class ChatPresentationMetadata implements IChatPresentationMetadata {
            constructor(properties?: synctv.client.IChatPresentationMetadata);
            public displayPosition?: (string|null);
            public displayColor?: (string|null);
            public _displayPosition?: "displayPosition";
            public _displayColor?: "displayColor";
            public static encode(message: synctv.client.IChatPresentationMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatPresentationMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAlistTarget {
            relativePath?: (string|null);
        }

        class AlistTarget implements IAlistTarget {
            constructor(properties?: synctv.client.IAlistTarget);
            public relativePath: string;
            public static encode(message: synctv.client.IAlistTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.AlistTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyItemTarget {
            itemId?: (string|null);
        }

        class EmbyItemTarget implements IEmbyItemTarget {
            constructor(properties?: synctv.client.IEmbyItemTarget);
            public itemId: string;
            public static encode(message: synctv.client.IEmbyItemTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.EmbyItemTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyPersonTarget {
            personId?: (string|null);
        }

        class EmbyPersonTarget implements IEmbyPersonTarget {
            constructor(properties?: synctv.client.IEmbyPersonTarget);
            public personId: string;
            public static encode(message: synctv.client.IEmbyPersonTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.EmbyPersonTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyPersonItemTarget {
            personId?: (string|null);
            itemId?: (string|null);
        }

        class EmbyPersonItemTarget implements IEmbyPersonItemTarget {
            constructor(properties?: synctv.client.IEmbyPersonItemTarget);
            public personId: string;
            public itemId: string;
            public static encode(message: synctv.client.IEmbyPersonItemTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.EmbyPersonItemTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyTarget {
            item?: (synctv.client.IEmbyItemTarget|null);
            person?: (synctv.client.IEmbyPersonTarget|null);
            personItem?: (synctv.client.IEmbyPersonItemTarget|null);
        }

        class EmbyTarget implements IEmbyTarget {
            constructor(properties?: synctv.client.IEmbyTarget);
            public item?: (synctv.client.IEmbyItemTarget|null);
            public person?: (synctv.client.IEmbyPersonTarget|null);
            public personItem?: (synctv.client.IEmbyPersonItemTarget|null);
            public target?: ("item"|"person"|"personItem");
            public static encode(message: synctv.client.IEmbyTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.EmbyTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICloudreveTarget {
            relativePath?: (string|null);
        }

        class CloudreveTarget implements ICloudreveTarget {
            constructor(properties?: synctv.client.ICloudreveTarget);
            public relativePath: string;
            public static encode(message: synctv.client.ICloudreveTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.CloudreveTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum TwitchTargetKind {
            TWITCH_TARGET_KIND_UNSPECIFIED = 0,
            TWITCH_TARGET_KIND_VIDEO = 1,
            TWITCH_TARGET_KIND_CLIP = 2,
            TWITCH_TARGET_KIND_LIVE = 3
        }

        interface ITwitchTarget {
            kind?: (synctv.client.TwitchTargetKind|null);
            id?: (string|null);
        }

        class TwitchTarget implements ITwitchTarget {
            constructor(properties?: synctv.client.ITwitchTarget);
            public kind: synctv.client.TwitchTargetKind;
            public id: string;
            public static encode(message: synctv.client.ITwitchTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TwitchTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosFileTarget {
            relativePath?: (string|null);
        }

        class FnosFileTarget implements IFnosFileTarget {
            constructor(properties?: synctv.client.IFnosFileTarget);
            public relativePath: string;
            public static encode(message: synctv.client.IFnosFileTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosFileTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosMediaItemTarget {
            itemGuid?: (string|null);
            mediaGuid?: (string|null);
            libraryGuid?: (string|null);
        }

        class FnosMediaItemTarget implements IFnosMediaItemTarget {
            constructor(properties?: synctv.client.IFnosMediaItemTarget);
            public itemGuid: string;
            public mediaGuid?: (string|null);
            public libraryGuid?: (string|null);
            public _mediaGuid?: "mediaGuid";
            public _libraryGuid?: "libraryGuid";
            public static encode(message: synctv.client.IFnosMediaItemTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosMediaItemTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosTarget {
            file?: (synctv.client.IFnosFileTarget|null);
            mediaItem?: (synctv.client.IFnosMediaItemTarget|null);
        }

        class FnosTarget implements IFnosTarget {
            constructor(properties?: synctv.client.IFnosTarget);
            public file?: (synctv.client.IFnosFileTarget|null);
            public mediaItem?: (synctv.client.IFnosMediaItemTarget|null);
            public target?: ("file"|"mediaItem");
            public static encode(message: synctv.client.IFnosTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IQnapTarget {
            relativePath?: (string|null);
        }

        class QnapTarget implements IQnapTarget {
            constructor(properties?: synctv.client.IQnapTarget);
            public relativePath: string;
            public static encode(message: synctv.client.IQnapTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.QnapTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyFileTarget {
            relativePath?: (string|null);
        }

        class SynologyFileTarget implements ISynologyFileTarget {
            constructor(properties?: synctv.client.ISynologyFileTarget);
            public relativePath: string;
            public static encode(message: synctv.client.ISynologyFileTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologyFileTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyLibraryItemTarget {
            kind?: (synctv.source_config.SynologyLibraryItemKind|null);
            itemId?: (number|Long|null);
            fileId?: (number|Long|null);
            parentId?: (number|Long|null);
        }

        class SynologyLibraryItemTarget implements ISynologyLibraryItemTarget {
            constructor(properties?: synctv.client.ISynologyLibraryItemTarget);
            public kind: synctv.source_config.SynologyLibraryItemKind;
            public itemId: (number|Long);
            public fileId: (number|Long);
            public parentId?: (number|Long|null);
            public _parentId?: "parentId";
            public static encode(message: synctv.client.ISynologyLibraryItemTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologyLibraryItemTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyTvShowTarget {
            libraryId?: (number|Long|null);
            tvShowId?: (number|Long|null);
        }

        class SynologyTvShowTarget implements ISynologyTvShowTarget {
            constructor(properties?: synctv.client.ISynologyTvShowTarget);
            public libraryId: (number|Long);
            public tvShowId: (number|Long);
            public static encode(message: synctv.client.ISynologyTvShowTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologyTvShowTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyTarget {
            file?: (synctv.client.ISynologyFileTarget|null);
            libraryItem?: (synctv.client.ISynologyLibraryItemTarget|null);
            tvShow?: (synctv.client.ISynologyTvShowTarget|null);
        }

        class SynologyTarget implements ISynologyTarget {
            constructor(properties?: synctv.client.ISynologyTarget);
            public file?: (synctv.client.ISynologyFileTarget|null);
            public libraryItem?: (synctv.client.ISynologyLibraryItemTarget|null);
            public tvShow?: (synctv.client.ISynologyTvShowTarget|null);
            public target?: ("file"|"libraryItem"|"tvShow");
            public static encode(message: synctv.client.ISynologyTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologyTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudTarget {
            path?: (string|null);
            fileId?: (number|Long|null);
        }

        class NextcloudTarget implements INextcloudTarget {
            constructor(properties?: synctv.client.INextcloudTarget);
            public path: string;
            public fileId: (number|Long);
            public static encode(message: synctv.client.INextcloudTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.NextcloudTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafileTarget {
            repositoryId?: (string|null);
            path?: (string|null);
            objectId?: (string|null);
            hasThumbnail?: (boolean|null);
        }

        class SeafileTarget implements ISeafileTarget {
            constructor(properties?: synctv.client.ISeafileTarget);
            public repositoryId: string;
            public path: string;
            public objectId: string;
            public hasThumbnail: boolean;
            public static encode(message: synctv.client.ISeafileTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SeafileTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITrueNasTarget {
            path?: (string|null);
        }

        class TrueNasTarget implements ITrueNasTarget {
            constructor(properties?: synctv.client.ITrueNasTarget);
            public path: string;
            public static encode(message: synctv.client.ITrueNasTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TrueNasTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDouyinTarget {
            awemeId?: (string|null);
        }

        class DouyinTarget implements IDouyinTarget {
            constructor(properties?: synctv.client.IDouyinTarget);
            public awemeId: string;
            public static encode(message: synctv.client.IDouyinTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.DouyinTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IYoutubeTarget {
            videoId?: (string|null);
        }

        class YoutubeTarget implements IYoutubeTarget {
            constructor(properties?: synctv.client.IYoutubeTarget);
            public videoId: string;
            public static encode(message: synctv.client.IYoutubeTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.YoutubeTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITikTokTarget {
            videoId?: (string|null);
        }

        class TikTokTarget implements ITikTokTarget {
            constructor(properties?: synctv.client.ITikTokTarget);
            public videoId: string;
            public static encode(message: synctv.client.ITikTokTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TikTokTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliVideoTarget {
            bvid?: (string|null);
            aid?: (number|Long|null);
        }

        class BilibiliVideoTarget implements IBilibiliVideoTarget {
            constructor(properties?: synctv.client.IBilibiliVideoTarget);
            public bvid: string;
            public aid: (number|Long);
            public static encode(message: synctv.client.IBilibiliVideoTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.BilibiliVideoTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliVideoPartTarget {
            bvid?: (string|null);
            aid?: (number|Long|null);
            cid?: (number|Long|null);
            page?: (number|null);
        }

        class BilibiliVideoPartTarget implements IBilibiliVideoPartTarget {
            constructor(properties?: synctv.client.IBilibiliVideoPartTarget);
            public bvid: string;
            public aid: (number|Long);
            public cid: (number|Long);
            public page: number;
            public static encode(message: synctv.client.IBilibiliVideoPartTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.BilibiliVideoPartTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliPgcEpisodeTarget {
            epid?: (number|Long|null);
            cid?: (number|Long|null);
        }

        class BilibiliPgcEpisodeTarget implements IBilibiliPgcEpisodeTarget {
            constructor(properties?: synctv.client.IBilibiliPgcEpisodeTarget);
            public epid: (number|Long);
            public cid: (number|Long);
            public static encode(message: synctv.client.IBilibiliPgcEpisodeTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.BilibiliPgcEpisodeTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliLiveTarget {
            roomId?: (number|Long|null);
        }

        class BilibiliLiveTarget implements IBilibiliLiveTarget {
            constructor(properties?: synctv.client.IBilibiliLiveTarget);
            public roomId: (number|Long);
            public static encode(message: synctv.client.IBilibiliLiveTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.BilibiliLiveTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliTarget {
            video?: (synctv.client.IBilibiliVideoTarget|null);
            videoPart?: (synctv.client.IBilibiliVideoPartTarget|null);
            pgcEpisode?: (synctv.client.IBilibiliPgcEpisodeTarget|null);
            live?: (synctv.client.IBilibiliLiveTarget|null);
        }

        class BilibiliTarget implements IBilibiliTarget {
            constructor(properties?: synctv.client.IBilibiliTarget);
            public video?: (synctv.client.IBilibiliVideoTarget|null);
            public videoPart?: (synctv.client.IBilibiliVideoPartTarget|null);
            public pgcEpisode?: (synctv.client.IBilibiliPgcEpisodeTarget|null);
            public live?: (synctv.client.IBilibiliLiveTarget|null);
            public target?: ("video"|"videoPart"|"pgcEpisode"|"live");
            public static encode(message: synctv.client.IBilibiliTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.BilibiliTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IProviderTarget {
            alist?: (synctv.client.IAlistTarget|null);
            emby?: (synctv.client.IEmbyTarget|null);
            cloudreve?: (synctv.client.ICloudreveTarget|null);
            twitch?: (synctv.client.ITwitchTarget|null);
            fnos?: (synctv.client.IFnosTarget|null);
            qnap?: (synctv.client.IQnapTarget|null);
            synology?: (synctv.client.ISynologyTarget|null);
            nextcloud?: (synctv.client.INextcloudTarget|null);
            seafile?: (synctv.client.ISeafileTarget|null);
            truenas?: (synctv.client.ITrueNasTarget|null);
            douyin?: (synctv.client.IDouyinTarget|null);
            youtube?: (synctv.client.IYoutubeTarget|null);
            tiktok?: (synctv.client.ITikTokTarget|null);
            bilibili?: (synctv.client.IBilibiliTarget|null);
        }

        class ProviderTarget implements IProviderTarget {
            constructor(properties?: synctv.client.IProviderTarget);
            public alist?: (synctv.client.IAlistTarget|null);
            public emby?: (synctv.client.IEmbyTarget|null);
            public cloudreve?: (synctv.client.ICloudreveTarget|null);
            public twitch?: (synctv.client.ITwitchTarget|null);
            public fnos?: (synctv.client.IFnosTarget|null);
            public qnap?: (synctv.client.IQnapTarget|null);
            public synology?: (synctv.client.ISynologyTarget|null);
            public nextcloud?: (synctv.client.INextcloudTarget|null);
            public seafile?: (synctv.client.ISeafileTarget|null);
            public truenas?: (synctv.client.ITrueNasTarget|null);
            public douyin?: (synctv.client.IDouyinTarget|null);
            public youtube?: (synctv.client.IYoutubeTarget|null);
            public tiktok?: (synctv.client.ITikTokTarget|null);
            public bilibili?: (synctv.client.IBilibiliTarget|null);
            public target?: ("alist"|"emby"|"cloudreve"|"twitch"|"fnos"|"qnap"|"synology"|"nextcloud"|"seafile"|"truenas"|"douyin"|"youtube"|"tiktok"|"bilibili");
            public static encode(message: synctv.client.IProviderTarget, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ProviderTarget;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatPlaybackMetadata {
            mediaId?: (string|null);
            playlistId?: (string|null);
            target?: (synctv.client.IProviderTarget|null);
            positionSeconds?: (number|null);
            mediaName?: (string|null);
            playlistName?: (string|null);
        }

        class ChatPlaybackMetadata implements IChatPlaybackMetadata {
            constructor(properties?: synctv.client.IChatPlaybackMetadata);
            public mediaId: string;
            public playlistId: string;
            public target?: (synctv.client.IProviderTarget|null);
            public positionSeconds?: (number|null);
            public mediaName: string;
            public playlistName: string;
            public _positionSeconds?: "positionSeconds";
            public static encode(message: synctv.client.IChatPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatUserMetadata {
            presentation?: (synctv.client.IChatPresentationMetadata|null);
            playback?: (synctv.client.IChatPlaybackMetadata|null);
        }

        class ChatUserMetadata implements IChatUserMetadata {
            constructor(properties?: synctv.client.IChatUserMetadata);
            public presentation?: (synctv.client.IChatPresentationMetadata|null);
            public playback?: (synctv.client.IChatPlaybackMetadata|null);
            public static encode(message: synctv.client.IChatUserMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatUserMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMemberJoinedMetadata {
            userId?: (string|null);
            username?: (string|null);
            actorUserId?: (string|null);
            actorUsername?: (string|null);
            role?: (synctv.common.RoomMemberRole|null);
        }

        class ChatMemberJoinedMetadata implements IChatMemberJoinedMetadata {
            constructor(properties?: synctv.client.IChatMemberJoinedMetadata);
            public userId: string;
            public username: string;
            public actorUserId: string;
            public actorUsername: string;
            public role: synctv.common.RoomMemberRole;
            public static encode(message: synctv.client.IChatMemberJoinedMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMemberJoinedMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaybackChangeReason {
            PLAYBACK_CHANGE_REASON_UNSPECIFIED = 0,
            PLAYBACK_CHANGE_REASON_SELECTED = 1,
            PLAYBACK_CHANGE_REASON_NEXT = 2,
            PLAYBACK_CHANGE_REASON_PREVIOUS = 3,
            PLAYBACK_CHANGE_REASON_HISTORY_ENTRY = 4,
            PLAYBACK_CHANGE_REASON_AUTO_ADVANCE = 5
        }

        interface IChatPlaybackChangedMetadata {
            from?: (synctv.client.IChatPlaybackMetadata|null);
            to?: (synctv.client.IChatPlaybackMetadata|null);
            reason?: (synctv.client.PlaybackChangeReason|null);
            actorUserId?: (string|null);
        }

        class ChatPlaybackChangedMetadata implements IChatPlaybackChangedMetadata {
            constructor(properties?: synctv.client.IChatPlaybackChangedMetadata);
            public from?: (synctv.client.IChatPlaybackMetadata|null);
            public to?: (synctv.client.IChatPlaybackMetadata|null);
            public reason: synctv.client.PlaybackChangeReason;
            public actorUserId: string;
            public static encode(message: synctv.client.IChatPlaybackChangedMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatPlaybackChangedMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMetadata {
            user?: (synctv.client.IChatUserMetadata|null);
            memberJoined?: (synctv.client.IChatMemberJoinedMetadata|null);
            playbackChanged?: (synctv.client.IChatPlaybackChangedMetadata|null);
        }

        class ChatMetadata implements IChatMetadata {
            constructor(properties?: synctv.client.IChatMetadata);
            public user?: (synctv.client.IChatUserMetadata|null);
            public memberJoined?: (synctv.client.IChatMemberJoinedMetadata|null);
            public playbackChanged?: (synctv.client.IChatPlaybackChangedMetadata|null);
            public metadata?: ("user"|"memberJoined"|"playbackChanged");
            public static encode(message: synctv.client.IChatMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMentionInput {
            userId?: (string|null);
            start?: (number|null);
            length?: (number|null);
        }

        class ChatMentionInput implements IChatMentionInput {
            constructor(properties?: synctv.client.IChatMentionInput);
            public userId: string;
            public start: number;
            public length: number;
            public static encode(message: synctv.client.IChatMentionInput, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMentionInput;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMessageSend {
            content?: (string|null);
            displayPosition?: (string|null);
            displayColor?: (string|null);
            clientMessageId?: (string|null);
            attachments?: (synctv.client.IChatAttachmentReference[]|null);
            replyToMessageId?: (string|null);
            metadata?: (synctv.client.IChatMetadata|null);
            mentions?: (synctv.client.IChatMentionInput[]|null);
        }

        class ChatMessageSend implements IChatMessageSend {
            constructor(properties?: synctv.client.IChatMessageSend);
            public content: string;
            public displayPosition: string;
            public displayColor: string;
            public clientMessageId: string;
            public attachments: synctv.client.IChatAttachmentReference[];
            public replyToMessageId: string;
            public metadata?: (synctv.client.IChatMetadata|null);
            public mentions: synctv.client.IChatMentionInput[];
            public static encode(message: synctv.client.IChatMessageSend, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMessageSend;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHeartbeatMessage {
            timestamp?: (number|Long|null);
        }

        class HeartbeatMessage implements IHeartbeatMessage {
            constructor(properties?: synctv.client.IHeartbeatMessage);
            public timestamp: (number|Long);
            public static encode(message: synctv.client.IHeartbeatMessage, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.HeartbeatMessage;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaybackUpdateType {
            PLAYBACK_UPDATE_TYPE_UNSPECIFIED = 0,
            PLAYBACK_UPDATE_TYPE_PLAY = 1,
            PLAYBACK_UPDATE_TYPE_PAUSE = 2,
            PLAYBACK_UPDATE_TYPE_SEEK = 3,
            PLAYBACK_UPDATE_TYPE_SPEED = 4
        }

        interface IUpdatePlaybackStateRequest {
            type?: (synctv.client.PlaybackUpdateType|null);
            playing?: (boolean|null);
            position?: (number|null);
            speed?: (number|null);
            version?: (number|Long|null);
            expectedMediaId?: (string|null);
            expectedPlaylistId?: (string|null);
            expectedTargetHash?: (string|null);
            clientOperationId?: (string|null);
            clientTimeMillis?: (number|Long|null);
        }

        class UpdatePlaybackStateRequest implements IUpdatePlaybackStateRequest {
            constructor(properties?: synctv.client.IUpdatePlaybackStateRequest);
            public type: synctv.client.PlaybackUpdateType;
            public playing?: (boolean|null);
            public position?: (number|null);
            public speed?: (number|null);
            public version?: (number|Long|null);
            public expectedMediaId?: (string|null);
            public expectedPlaylistId?: (string|null);
            public expectedTargetHash?: (string|null);
            public clientOperationId?: (string|null);
            public clientTimeMillis?: (number|Long|null);
            public _playing?: "playing";
            public _position?: "position";
            public _speed?: "speed";
            public _version?: "version";
            public _expectedMediaId?: "expectedMediaId";
            public _expectedPlaylistId?: "expectedPlaylistId";
            public _expectedTargetHash?: "expectedTargetHash";
            public _clientOperationId?: "clientOperationId";
            public _clientTimeMillis?: "clientTimeMillis";
            public static encode(message: synctv.client.IUpdatePlaybackStateRequest, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.UpdatePlaybackStateRequest;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IUpdatePlaybackRequest {
            mediaId?: (string|null);
            playlistId?: (string|null);
            target?: (synctv.client.IProviderTarget|null);
            clientOperationId?: (string|null);
        }

        class UpdatePlaybackRequest implements IUpdatePlaybackRequest {
            constructor(properties?: synctv.client.IUpdatePlaybackRequest);
            public mediaId: string;
            public playlistId: string;
            public target?: (synctv.client.IProviderTarget|null);
            public clientOperationId?: (string|null);
            public _clientOperationId?: "clientOperationId";
            public static encode(message: synctv.client.IUpdatePlaybackRequest, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.UpdatePlaybackRequest;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum ResourceDeliveryMode {
            RESOURCE_DELIVERY_MODE_UNSPECIFIED = 0,
            RESOURCE_DELIVERY_MODE_NOTIFY_ONLY = 1,
            RESOURCE_DELIVERY_MODE_PUSH_SNAPSHOT = 2
        }

        interface IObservePlaybackState {
            eventSequence?: (number|Long|null);
        }

        class ObservePlaybackState implements IObservePlaybackState {
            constructor(properties?: synctv.client.IObservePlaybackState);
            public eventSequence?: (number|Long|null);
            public _eventSequence?: "eventSequence";
            public static encode(message: synctv.client.IObservePlaybackState, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObservePlaybackState;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaybackStreamPreference {
            PLAYBACK_STREAM_PREFERENCE_UNSPECIFIED = 0,
            PLAYBACK_STREAM_PREFERENCE_AUTO = 1,
            PLAYBACK_STREAM_PREFERENCE_DIRECT_PLAY = 2,
            PLAYBACK_STREAM_PREFERENCE_TRANSCODE = 3
        }

        enum PlaybackVideoCodec {
            PLAYBACK_VIDEO_CODEC_UNSPECIFIED = 0,
            PLAYBACK_VIDEO_CODEC_H264 = 1,
            PLAYBACK_VIDEO_CODEC_HEVC = 2,
            PLAYBACK_VIDEO_CODEC_VP9 = 3,
            PLAYBACK_VIDEO_CODEC_AV1 = 4
        }

        enum PlaybackContainer {
            PLAYBACK_CONTAINER_UNSPECIFIED = 0,
            PLAYBACK_CONTAINER_MP4 = 1,
            PLAYBACK_CONTAINER_MKV = 2,
            PLAYBACK_CONTAINER_WEBM = 3
        }

        enum PlaybackAudioCapability {
            PLAYBACK_AUDIO_CAPABILITY_UNSPECIFIED = 0,
            PLAYBACK_AUDIO_CAPABILITY_STEREO = 1,
            PLAYBACK_AUDIO_CAPABILITY_SURROUND = 2,
            PLAYBACK_AUDIO_CAPABILITY_LOSSLESS_SURROUND = 3
        }

        enum PlaybackSubtitlePreference {
            PLAYBACK_SUBTITLE_PREFERENCE_UNSPECIFIED = 0,
            PLAYBACK_SUBTITLE_PREFERENCE_EXTERNAL = 1,
            PLAYBACK_SUBTITLE_PREFERENCE_EMBEDDED_OR_EXTERNAL = 2,
            PLAYBACK_SUBTITLE_PREFERENCE_NONE = 3
        }

        enum PlaybackLiveTransport {
            PLAYBACK_LIVE_TRANSPORT_UNSPECIFIED = 0,
            PLAYBACK_LIVE_TRANSPORT_HLS = 1,
            PLAYBACK_LIVE_TRANSPORT_FLV = 2,
            PLAYBACK_LIVE_TRANSPORT_WHEP = 3
        }

        enum PlaybackClientEnvironment {
            PLAYBACK_CLIENT_ENVIRONMENT_UNSPECIFIED = 0,
            PLAYBACK_CLIENT_ENVIRONMENT_NATIVE = 1,
            PLAYBACK_CLIENT_ENVIRONMENT_WEB = 2
        }

        enum PlaybackMediaTransport {
            PLAYBACK_MEDIA_TRANSPORT_UNSPECIFIED = 0,
            PLAYBACK_MEDIA_TRANSPORT_PROGRESSIVE = 1,
            PLAYBACK_MEDIA_TRANSPORT_HLS = 2,
            PLAYBACK_MEDIA_TRANSPORT_DASH = 3,
            PLAYBACK_MEDIA_TRANSPORT_FLV = 4,
            PLAYBACK_MEDIA_TRANSPORT_MPEG_TS = 5,
            PLAYBACK_MEDIA_TRANSPORT_WEB_RTC = 6
        }

        enum PlaybackAudioCodec {
            PLAYBACK_AUDIO_CODEC_UNSPECIFIED = 0,
            PLAYBACK_AUDIO_CODEC_AAC = 1,
            PLAYBACK_AUDIO_CODEC_MP3 = 2,
            PLAYBACK_AUDIO_CODEC_OPUS = 3,
            PLAYBACK_AUDIO_CODEC_VORBIS = 4,
            PLAYBACK_AUDIO_CODEC_AC3 = 5,
            PLAYBACK_AUDIO_CODEC_EAC3 = 6,
            PLAYBACK_AUDIO_CODEC_FLAC = 7
        }

        enum PlaybackMediaPipeline {
            PLAYBACK_MEDIA_PIPELINE_UNSPECIFIED = 0,
            PLAYBACK_MEDIA_PIPELINE_NATIVE = 1,
            PLAYBACK_MEDIA_PIPELINE_MEDIA_SOURCE = 2,
            PLAYBACK_MEDIA_PIPELINE_MANAGED_MEDIA_SOURCE = 3
        }

        interface IPlaybackMediaCapability {
            transport?: (synctv.client.PlaybackMediaTransport|null);
            container?: (synctv.client.PlaybackContainer|null);
            videoCodec?: (synctv.client.PlaybackVideoCodec|null);
            audioCodec?: (synctv.client.PlaybackAudioCodec|null);
            pipeline?: (synctv.client.PlaybackMediaPipeline|null);
            codecString?: (string|null);
        }

        class PlaybackMediaCapability implements IPlaybackMediaCapability {
            constructor(properties?: synctv.client.IPlaybackMediaCapability);
            public transport: synctv.client.PlaybackMediaTransport;
            public container?: (synctv.client.PlaybackContainer|null);
            public videoCodec?: (synctv.client.PlaybackVideoCodec|null);
            public audioCodec?: (synctv.client.PlaybackAudioCodec|null);
            public pipeline: synctv.client.PlaybackMediaPipeline;
            public codecString?: (string|null);
            public _container?: "container";
            public _videoCodec?: "videoCodec";
            public _audioCodec?: "audioCodec";
            public _codecString?: "codecString";
            public static encode(message: synctv.client.IPlaybackMediaCapability, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackMediaCapability;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackClientProfile {
            streamPreference?: (synctv.client.PlaybackStreamPreference|null);
            maxStreamingBitrate?: (number|Long|null);
            maxAudioChannels?: (number|null);
            supportedVideoCodecs?: (synctv.client.PlaybackVideoCodec[]|null);
            supportedContainers?: (synctv.client.PlaybackContainer[]|null);
            audioCapability?: (synctv.client.PlaybackAudioCapability|null);
            subtitlePreference?: (synctv.client.PlaybackSubtitlePreference|null);
            supportedLiveTransports?: (synctv.client.PlaybackLiveTransport[]|null);
            profileVersion?: (number|null);
            environment?: (synctv.client.PlaybackClientEnvironment|null);
            mediaCapabilities?: (synctv.client.IPlaybackMediaCapability[]|null);
            supportsCustomHttpHeaders?: (boolean|null);
            supportsProviderProxy?: (boolean|null);
            supportsInsecureHttpMedia?: (boolean|null);
        }

        class PlaybackClientProfile implements IPlaybackClientProfile {
            constructor(properties?: synctv.client.IPlaybackClientProfile);
            public streamPreference: synctv.client.PlaybackStreamPreference;
            public maxStreamingBitrate?: (number|Long|null);
            public maxAudioChannels?: (number|null);
            public supportedVideoCodecs: synctv.client.PlaybackVideoCodec[];
            public supportedContainers: synctv.client.PlaybackContainer[];
            public audioCapability: synctv.client.PlaybackAudioCapability;
            public subtitlePreference: synctv.client.PlaybackSubtitlePreference;
            public supportedLiveTransports: synctv.client.PlaybackLiveTransport[];
            public profileVersion: number;
            public environment: synctv.client.PlaybackClientEnvironment;
            public mediaCapabilities: synctv.client.IPlaybackMediaCapability[];
            public supportsCustomHttpHeaders: boolean;
            public supportsProviderProxy: boolean;
            public supportsInsecureHttpMedia: boolean;
            public _maxStreamingBitrate?: "maxStreamingBitrate";
            public _maxAudioChannels?: "maxAudioChannels";
            public static encode(message: synctv.client.IPlaybackClientProfile, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackClientProfile;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObservePlayback {
            playbackClientProfile?: (synctv.client.IPlaybackClientProfile|null);
        }

        class ObservePlayback implements IObservePlayback {
            constructor(properties?: synctv.client.IObservePlayback);
            public playbackClientProfile?: (synctv.client.IPlaybackClientProfile|null);
            public static encode(message: synctv.client.IObservePlayback, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObservePlayback;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObserveRoomSettings {
            afterEventSequence?: (number|Long|null);
        }

        class ObserveRoomSettings implements IObserveRoomSettings {
            constructor(properties?: synctv.client.IObserveRoomSettings);
            public afterEventSequence?: (number|Long|null);
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObserveRoomSettings, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveRoomSettings;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPagePagination {
            page?: (number|null);
        }

        class PagePagination implements IPagePagination {
            constructor(properties?: synctv.client.IPagePagination);
            public page: number;
            public static encode(message: synctv.client.IPagePagination, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PagePagination;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICursorPagination {
            cursor?: (string|null);
        }

        class CursorPagination implements ICursorPagination {
            constructor(properties?: synctv.client.ICursorPagination);
            public cursor: string;
            public static encode(message: synctv.client.ICursorPagination, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.CursorPagination;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum MediaListSortBy {
            MEDIA_LIST_SORT_BY_UNSPECIFIED = 0,
            MEDIA_LIST_SORT_BY_POSITION = 1,
            MEDIA_LIST_SORT_BY_NAME = 2,
            MEDIA_LIST_SORT_BY_ADDED_AT = 3,
            MEDIA_LIST_SORT_BY_UPDATED_AT = 4,
            MEDIA_LIST_SORT_BY_SOURCE_PROVIDER = 5,
            MEDIA_LIST_SORT_BY_PROVIDER_INSTANCE_NAME = 6
        }

        enum SortDirection {
            SORT_DIRECTION_UNSPECIFIED = 0,
            SORT_DIRECTION_ASC = 1,
            SORT_DIRECTION_DESC = 2
        }

        enum ResourceAvailabilityFilter {
            RESOURCE_AVAILABILITY_FILTER_ALL = 0,
            RESOURCE_AVAILABILITY_FILTER_AVAILABLE = 1,
            RESOURCE_AVAILABILITY_FILTER_UNAVAILABLE = 2
        }

        interface IListPlaylistItemsRequest {
            playlistId?: (string|null);
            target?: (synctv.client.IProviderTarget|null);
            page?: (synctv.client.IPagePagination|null);
            cursor?: (synctv.client.ICursorPagination|null);
            pageSize?: (number|null);
            search?: (string|null);
            sourceProvider?: (synctv.source_config.SourceProvider|null);
            providerInstanceName?: (string|null);
            sortBy?: (synctv.client.MediaListSortBy|null);
            sortDirection?: (synctv.client.SortDirection|null);
            availability?: (synctv.client.ResourceAvailabilityFilter|null);
            refresh?: (boolean|null);
            previewSourceConfig?: (synctv.source_config.IPlaylistSourceConfig|null);
        }

        class ListPlaylistItemsRequest implements IListPlaylistItemsRequest {
            constructor(properties?: synctv.client.IListPlaylistItemsRequest);
            public playlistId: string;
            public target?: (synctv.client.IProviderTarget|null);
            public page?: (synctv.client.IPagePagination|null);
            public cursor?: (synctv.client.ICursorPagination|null);
            public pageSize: number;
            public search: string;
            public sourceProvider: synctv.source_config.SourceProvider;
            public providerInstanceName: string;
            public sortBy: synctv.client.MediaListSortBy;
            public sortDirection: synctv.client.SortDirection;
            public availability: synctv.client.ResourceAvailabilityFilter;
            public refresh: boolean;
            public previewSourceConfig?: (synctv.source_config.IPlaylistSourceConfig|null);
            public pagination?: ("page"|"cursor");
            public static encode(message: synctv.client.IListPlaylistItemsRequest, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ListPlaylistItemsRequest;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObservePlaylistItems {
            request?: (synctv.client.IListPlaylistItemsRequest|null);
            afterEventSequence?: (number|Long|null);
        }

        class ObservePlaylistItems implements IObservePlaylistItems {
            constructor(properties?: synctv.client.IObservePlaylistItems);
            public request?: (synctv.client.IListPlaylistItemsRequest|null);
            public afterEventSequence?: (number|Long|null);
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObservePlaylistItems, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObservePlaylistItems;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObserveRoomMemberEvents {
            afterEventSequence?: (number|Long|null);
        }

        class ObserveRoomMemberEvents implements IObserveRoomMemberEvents {
            constructor(properties?: synctv.client.IObserveRoomMemberEvents);
            public afterEventSequence?: (number|Long|null);
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObserveRoomMemberEvents, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveRoomMemberEvents;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum ChatMessageType {
            CHAT_MESSAGE_TYPE_UNSPECIFIED = 0,
            CHAT_MESSAGE_TYPE_USER = 1,
            CHAT_MESSAGE_TYPE_SYSTEM_MEMBER_JOINED = 1001,
            CHAT_MESSAGE_TYPE_SYSTEM_PLAYBACK_CHANGED = 1002
        }

        interface IObserveChatEvents {
            afterEventSequence?: (number|Long|null);
            includeMessageTypes?: (synctv.client.ChatMessageType[]|null);
        }

        class ObserveChatEvents implements IObserveChatEvents {
            constructor(properties?: synctv.client.IObserveChatEvents);
            public afterEventSequence?: (number|Long|null);
            public includeMessageTypes: synctv.client.ChatMessageType[];
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObserveChatEvents, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveChatEvents;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObserveOnlineCount {
            roles?: (synctv.common.RoomMemberRole[]|null);
            userIds?: (string[]|null);
        }

        class ObserveOnlineCount implements IObserveOnlineCount {
            constructor(properties?: synctv.client.IObserveOnlineCount);
            public roles: synctv.common.RoomMemberRole[];
            public userIds: string[];
            public static encode(message: synctv.client.IObserveOnlineCount, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveOnlineCount;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum OnlineEventKind {
            ONLINE_EVENT_KIND_UNSPECIFIED = 0,
            ONLINE_EVENT_KIND_JOINED = 1,
            ONLINE_EVENT_KIND_LEFT = 2
        }

        interface IObserveOnlineEvent {
            roles?: (synctv.common.RoomMemberRole[]|null);
            kinds?: (synctv.client.OnlineEventKind[]|null);
            userIds?: (string[]|null);
        }

        class ObserveOnlineEvent implements IObserveOnlineEvent {
            constructor(properties?: synctv.client.IObserveOnlineEvent);
            public roles: synctv.common.RoomMemberRole[];
            public kinds: synctv.client.OnlineEventKind[];
            public userIds: string[];
            public static encode(message: synctv.client.IObserveOnlineEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveOnlineEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObserveSelfRoomMember {
            afterEventSequence?: (number|Long|null);
        }

        class ObserveSelfRoomMember implements IObserveSelfRoomMember {
            constructor(properties?: synctv.client.IObserveSelfRoomMember);
            public afterEventSequence?: (number|Long|null);
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObserveSelfRoomMember, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveSelfRoomMember;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObserveChatPinEvents {
            afterEventSequence?: (number|Long|null);
        }

        class ObserveChatPinEvents implements IObserveChatPinEvents {
            constructor(properties?: synctv.client.IObserveChatPinEvents);
            public afterEventSequence?: (number|Long|null);
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObserveChatPinEvents, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveChatPinEvents;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IListPlaybackHistoryRequest {
            limit?: (number|null);
            cursorEntryId?: (string|null);
            sortDirection?: (synctv.client.SortDirection|null);
        }

        class ListPlaybackHistoryRequest implements IListPlaybackHistoryRequest {
            constructor(properties?: synctv.client.IListPlaybackHistoryRequest);
            public limit: number;
            public cursorEntryId?: (string|null);
            public sortDirection: synctv.client.SortDirection;
            public _cursorEntryId?: "cursorEntryId";
            public static encode(message: synctv.client.IListPlaybackHistoryRequest, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ListPlaybackHistoryRequest;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObservePlaybackHistory {
            request?: (synctv.client.IListPlaybackHistoryRequest|null);
            afterEventSequence?: (number|Long|null);
        }

        class ObservePlaybackHistory implements IObservePlaybackHistory {
            constructor(properties?: synctv.client.IObservePlaybackHistory);
            public request?: (synctv.client.IListPlaybackHistoryRequest|null);
            public afterEventSequence?: (number|Long|null);
            public _afterEventSequence?: "afterEventSequence";
            public static encode(message: synctv.client.IObservePlaybackHistory, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObservePlaybackHistory;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IObserveResource {
            observeId?: (string|null);
            deliveryMode?: (synctv.client.ResourceDeliveryMode|null);
            playbackState?: (synctv.client.IObservePlaybackState|null);
            playback?: (synctv.client.IObservePlayback|null);
            roomSettings?: (synctv.client.IObserveRoomSettings|null);
            playlistItems?: (synctv.client.IObservePlaylistItems|null);
            roomMemberEvents?: (synctv.client.IObserveRoomMemberEvents|null);
            chatEvents?: (synctv.client.IObserveChatEvents|null);
            onlineCount?: (synctv.client.IObserveOnlineCount|null);
            onlineEvent?: (synctv.client.IObserveOnlineEvent|null);
            selfRoomMember?: (synctv.client.IObserveSelfRoomMember|null);
            chatPinEvents?: (synctv.client.IObserveChatPinEvents|null);
            playbackHistory?: (synctv.client.IObservePlaybackHistory|null);
        }

        class ObserveResource implements IObserveResource {
            constructor(properties?: synctv.client.IObserveResource);
            public observeId: string;
            public deliveryMode: synctv.client.ResourceDeliveryMode;
            public playbackState?: (synctv.client.IObservePlaybackState|null);
            public playback?: (synctv.client.IObservePlayback|null);
            public roomSettings?: (synctv.client.IObserveRoomSettings|null);
            public playlistItems?: (synctv.client.IObservePlaylistItems|null);
            public roomMemberEvents?: (synctv.client.IObserveRoomMemberEvents|null);
            public chatEvents?: (synctv.client.IObserveChatEvents|null);
            public onlineCount?: (synctv.client.IObserveOnlineCount|null);
            public onlineEvent?: (synctv.client.IObserveOnlineEvent|null);
            public selfRoomMember?: (synctv.client.IObserveSelfRoomMember|null);
            public chatPinEvents?: (synctv.client.IObserveChatPinEvents|null);
            public playbackHistory?: (synctv.client.IObservePlaybackHistory|null);
            public resource?: ("playbackState"|"playback"|"roomSettings"|"playlistItems"|"roomMemberEvents"|"chatEvents"|"onlineCount"|"onlineEvent"|"selfRoomMember"|"chatPinEvents"|"playbackHistory");
            public static encode(message: synctv.client.IObserveResource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ObserveResource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IUnobserveResource {
            observeId?: (string|null);
        }

        class UnobserveResource implements IUnobserveResource {
            constructor(properties?: synctv.client.IUnobserveResource);
            public observeId: string;
            public static encode(message: synctv.client.IUnobserveResource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.UnobserveResource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceOfferCommand {
            to?: (string|null);
            data?: (string|null);
        }

        class WebRTCVoiceOfferCommand implements IWebRTCVoiceOfferCommand {
            constructor(properties?: synctv.client.IWebRTCVoiceOfferCommand);
            public to: string;
            public data: string;
            public static encode(message: synctv.client.IWebRTCVoiceOfferCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceOfferCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceAnswerCommand {
            to?: (string|null);
            data?: (string|null);
        }

        class WebRTCVoiceAnswerCommand implements IWebRTCVoiceAnswerCommand {
            constructor(properties?: synctv.client.IWebRTCVoiceAnswerCommand);
            public to: string;
            public data: string;
            public static encode(message: synctv.client.IWebRTCVoiceAnswerCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceAnswerCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceIceCandidateCommand {
            to?: (string|null);
            data?: (string|null);
        }

        class WebRTCVoiceIceCandidateCommand implements IWebRTCVoiceIceCandidateCommand {
            constructor(properties?: synctv.client.IWebRTCVoiceIceCandidateCommand);
            public to: string;
            public data: string;
            public static encode(message: synctv.client.IWebRTCVoiceIceCandidateCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceIceCandidateCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceJoinCommand {
            clientOperationId?: (string|null);
        }

        class WebRTCVoiceJoinCommand implements IWebRTCVoiceJoinCommand {
            constructor(properties?: synctv.client.IWebRTCVoiceJoinCommand);
            public clientOperationId?: (string|null);
            public _clientOperationId?: "clientOperationId";
            public static encode(message: synctv.client.IWebRTCVoiceJoinCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceJoinCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceLeaveCommand {
        }

        class WebRTCVoiceLeaveCommand implements IWebRTCVoiceLeaveCommand {
            constructor(properties?: synctv.client.IWebRTCVoiceLeaveCommand);
            public static encode(message: synctv.client.IWebRTCVoiceLeaveCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceLeaveCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaOfferCommand {
            to?: (string|null);
            data?: (string|null);
            swarmId?: (string|null);
        }

        class WebRTCMediaOfferCommand implements IWebRTCMediaOfferCommand {
            constructor(properties?: synctv.client.IWebRTCMediaOfferCommand);
            public to: string;
            public data: string;
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaOfferCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaOfferCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaAnswerCommand {
            to?: (string|null);
            data?: (string|null);
            swarmId?: (string|null);
        }

        class WebRTCMediaAnswerCommand implements IWebRTCMediaAnswerCommand {
            constructor(properties?: synctv.client.IWebRTCMediaAnswerCommand);
            public to: string;
            public data: string;
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaAnswerCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaAnswerCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaIceCandidateCommand {
            to?: (string|null);
            data?: (string|null);
            swarmId?: (string|null);
        }

        class WebRTCMediaIceCandidateCommand implements IWebRTCMediaIceCandidateCommand {
            constructor(properties?: synctv.client.IWebRTCMediaIceCandidateCommand);
            public to: string;
            public data: string;
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaIceCandidateCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaIceCandidateCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaSwarmJoin {
            swarmId?: (string|null);
            swarmTicket?: (string|null);
        }

        class WebRTCMediaSwarmJoin implements IWebRTCMediaSwarmJoin {
            constructor(properties?: synctv.client.IWebRTCMediaSwarmJoin);
            public swarmId: string;
            public swarmTicket: string;
            public static encode(message: synctv.client.IWebRTCMediaSwarmJoin, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaSwarmJoin;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaSwarmLeave {
            swarmId?: (string|null);
        }

        class WebRTCMediaSwarmLeave implements IWebRTCMediaSwarmLeave {
            constructor(properties?: synctv.client.IWebRTCMediaSwarmLeave);
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaSwarmLeave, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaSwarmLeave;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCCommand {
            voiceOffer?: (synctv.client.IWebRTCVoiceOfferCommand|null);
            voiceAnswer?: (synctv.client.IWebRTCVoiceAnswerCommand|null);
            voiceIceCandidate?: (synctv.client.IWebRTCVoiceIceCandidateCommand|null);
            voiceJoin?: (synctv.client.IWebRTCVoiceJoinCommand|null);
            voiceLeave?: (synctv.client.IWebRTCVoiceLeaveCommand|null);
            mediaOffer?: (synctv.client.IWebRTCMediaOfferCommand|null);
            mediaAnswer?: (synctv.client.IWebRTCMediaAnswerCommand|null);
            mediaIceCandidate?: (synctv.client.IWebRTCMediaIceCandidateCommand|null);
            mediaSwarmJoin?: (synctv.client.IWebRTCMediaSwarmJoin|null);
            mediaSwarmLeave?: (synctv.client.IWebRTCMediaSwarmLeave|null);
        }

        class WebRTCCommand implements IWebRTCCommand {
            constructor(properties?: synctv.client.IWebRTCCommand);
            public voiceOffer?: (synctv.client.IWebRTCVoiceOfferCommand|null);
            public voiceAnswer?: (synctv.client.IWebRTCVoiceAnswerCommand|null);
            public voiceIceCandidate?: (synctv.client.IWebRTCVoiceIceCandidateCommand|null);
            public voiceJoin?: (synctv.client.IWebRTCVoiceJoinCommand|null);
            public voiceLeave?: (synctv.client.IWebRTCVoiceLeaveCommand|null);
            public mediaOffer?: (synctv.client.IWebRTCMediaOfferCommand|null);
            public mediaAnswer?: (synctv.client.IWebRTCMediaAnswerCommand|null);
            public mediaIceCandidate?: (synctv.client.IWebRTCMediaIceCandidateCommand|null);
            public mediaSwarmJoin?: (synctv.client.IWebRTCMediaSwarmJoin|null);
            public mediaSwarmLeave?: (synctv.client.IWebRTCMediaSwarmLeave|null);
            public command?: ("voiceOffer"|"voiceAnswer"|"voiceIceCandidate"|"voiceJoin"|"voiceLeave"|"mediaOffer"|"mediaAnswer"|"mediaIceCandidate"|"mediaSwarmJoin"|"mediaSwarmLeave");
            public static encode(message: synctv.client.IWebRTCCommand, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCCommand;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IClientMessage {
            chat?: (synctv.client.IChatMessageSend|null);
            heartbeat?: (synctv.client.IHeartbeatMessage|null);
            playbackStateUpdate?: (synctv.client.IUpdatePlaybackStateRequest|null);
            playbackUpdate?: (synctv.client.IUpdatePlaybackRequest|null);
            observeResource?: (synctv.client.IObserveResource|null);
            unobserveResource?: (synctv.client.IUnobserveResource|null);
            webrtc?: (synctv.client.IWebRTCCommand|null);
        }

        class ClientMessage implements IClientMessage {
            constructor(properties?: synctv.client.IClientMessage);
            public chat?: (synctv.client.IChatMessageSend|null);
            public heartbeat?: (synctv.client.IHeartbeatMessage|null);
            public playbackStateUpdate?: (synctv.client.IUpdatePlaybackStateRequest|null);
            public playbackUpdate?: (synctv.client.IUpdatePlaybackRequest|null);
            public observeResource?: (synctv.client.IObserveResource|null);
            public unobserveResource?: (synctv.client.IUnobserveResource|null);
            public webrtc?: (synctv.client.IWebRTCCommand|null);
            public message?: ("chat"|"heartbeat"|"playbackStateUpdate"|"playbackUpdate"|"observeResource"|"unobserveResource"|"webrtc");
            public static encode(message: synctv.client.IClientMessage, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ClientMessage;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHeartbeatAck {
            timestamp?: (number|Long|null);
        }

        class HeartbeatAck implements IHeartbeatAck {
            constructor(properties?: synctv.client.IHeartbeatAck);
            public timestamp: (number|Long);
            public static encode(message: synctv.client.IHeartbeatAck, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.HeartbeatAck;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IErrorMessage {
            message?: (string|null);
            code?: (number|null);
            detail?: (string|null);
            clientOperationId?: (string|null);
        }

        class ErrorMessage implements IErrorMessage {
            constructor(properties?: synctv.client.IErrorMessage);
            public message: string;
            public code: number;
            public detail: string;
            public clientOperationId: string;
            public static encode(message: synctv.client.IErrorMessage, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ErrorMessage;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum NotificationType {
            NOTIFICATION_TYPE_UNSPECIFIED = 0,
            NOTIFICATION_TYPE_ROOM_INVITATION = 1,
            NOTIFICATION_TYPE_SYSTEM_ANNOUNCEMENT = 2,
            NOTIFICATION_TYPE_ROOM_EVENT = 3,
            NOTIFICATION_TYPE_PASSWORD_RESET = 4,
            NOTIFICATION_TYPE_EMAIL_BIND = 5
        }

        interface INotificationData {
            roomId?: (string|null);
            roomName?: (string|null);
            userId?: (string|null);
            username?: (string|null);
            messageId?: (string|null);
            actionUrl?: (string|null);
        }

        class NotificationData implements INotificationData {
            constructor(properties?: synctv.client.INotificationData);
            public roomId?: (string|null);
            public roomName?: (string|null);
            public userId?: (string|null);
            public username?: (string|null);
            public messageId?: (string|null);
            public actionUrl?: (string|null);
            public _roomId?: "roomId";
            public _roomName?: "roomName";
            public _userId?: "userId";
            public _username?: "username";
            public _messageId?: "messageId";
            public _actionUrl?: "actionUrl";
            public static encode(message: synctv.client.INotificationData, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.NotificationData;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IUserNotification {
            notificationId?: (string|null);
            notificationType?: (synctv.client.NotificationType|null);
            title?: (string|null);
            content?: (string|null);
            data?: (synctv.client.INotificationData|null);
            timestamp?: (number|Long|null);
        }

        class UserNotification implements IUserNotification {
            constructor(properties?: synctv.client.IUserNotification);
            public notificationId: string;
            public notificationType: synctv.client.NotificationType;
            public title: string;
            public content: string;
            public data?: (synctv.client.INotificationData|null);
            public timestamp: (number|Long);
            public static encode(message: synctv.client.IUserNotification, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.UserNotification;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEventCursor {
            eventId?: (string|null);
            sequence?: (number|Long|null);
        }

        class EventCursor implements IEventCursor {
            constructor(properties?: synctv.client.IEventCursor);
            public eventId?: (string|null);
            public sequence: (number|Long);
            public _eventId?: "eventId";
            public static encode(message: synctv.client.IEventCursor, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.EventCursor;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IResourceObserved {
            observeId?: (string|null);
            changed?: (boolean|null);
            eventCursor?: (synctv.client.IEventCursor|null);
        }

        class ResourceObserved implements IResourceObserved {
            constructor(properties?: synctv.client.IResourceObserved);
            public observeId: string;
            public changed: boolean;
            public eventCursor?: (synctv.client.IEventCursor|null);
            public static encode(message: synctv.client.IResourceObserved, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ResourceObserved;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IResourceEventOnly {
        }

        class ResourceEventOnly implements IResourceEventOnly {
            constructor(properties?: synctv.client.IResourceEventOnly);
            public static encode(message: synctv.client.IResourceEventOnly, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ResourceEventOnly;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackState {
            roomId?: (string|null);
            playingMediaId?: (string|null);
            position?: (number|null);
            speed?: (number|null);
            isPlaying?: (boolean|null);
            updatedAt?: (number|Long|null);
            version?: (number|Long|null);
            playingPlaylistId?: (string|null);
            target?: (synctv.client.IProviderTarget|null);
            targetHash?: (string|null);
            generatedAtMillis?: (number|Long|null);
            historyCursorId?: (string|null);
            clientOperationId?: (string|null);
        }

        class PlaybackState implements IPlaybackState {
            constructor(properties?: synctv.client.IPlaybackState);
            public roomId: string;
            public playingMediaId: string;
            public position: number;
            public speed: number;
            public isPlaying: boolean;
            public updatedAt: (number|Long);
            public version: (number|Long);
            public playingPlaylistId: string;
            public target?: (synctv.client.IProviderTarget|null);
            public targetHash: string;
            public generatedAtMillis: (number|Long);
            public historyCursorId: string;
            public clientOperationId: string;
            public static encode(message: synctv.client.IPlaybackState, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackState;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackMediaMetadata {
            resolution?: (string|null);
            bitrate?: (number|Long|null);
            codec?: (string|null);
            fps?: (number|null);
        }

        class PlaybackMediaMetadata implements IPlaybackMediaMetadata {
            constructor(properties?: synctv.client.IPlaybackMediaMetadata);
            public resolution?: (string|null);
            public bitrate?: (number|Long|null);
            public codec?: (string|null);
            public fps?: (number|null);
            public _resolution?: "resolution";
            public _bitrate?: "bitrate";
            public _codec?: "codec";
            public _fps?: "fps";
            public static encode(message: synctv.client.IPlaybackMediaMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackMediaMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IP2pResourceDelivery {
            swarmId?: (string|null);
            swarmTicket?: (string|null);
        }

        class P2pResourceDelivery implements IP2pResourceDelivery {
            constructor(properties?: synctv.client.IP2pResourceDelivery);
            public swarmId: string;
            public swarmTicket: string;
            public static encode(message: synctv.client.IP2pResourceDelivery, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.P2pResourceDelivery;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackMedia {
            name?: (string|null);
            url?: (string|null);
            headers?: ({ [k: string]: string }|null);
            format?: (string|null);
            expireAt?: (number|Long|null);
            metadata?: (synctv.client.IPlaybackMediaMetadata|null);
            p2pDelivery?: (synctv.client.IP2pResourceDelivery|null);
        }

        class PlaybackMedia implements IPlaybackMedia {
            constructor(properties?: synctv.client.IPlaybackMedia);
            public name: string;
            public url: string;
            public headers: { [k: string]: string };
            public format: string;
            public expireAt?: (number|Long|null);
            public metadata?: (synctv.client.IPlaybackMediaMetadata|null);
            public p2pDelivery?: (synctv.client.IP2pResourceDelivery|null);
            public _expireAt?: "expireAt";
            public _metadata?: "metadata";
            public _p2pDelivery?: "p2pDelivery";
            public static encode(message: synctv.client.IPlaybackMedia, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackMedia;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackSubtitle {
            name?: (string|null);
            language?: (string|null);
            url?: (string|null);
            headers?: ({ [k: string]: string }|null);
            format?: (string|null);
            expireAt?: (number|Long|null);
            p2pDelivery?: (synctv.client.IP2pResourceDelivery|null);
        }

        class PlaybackSubtitle implements IPlaybackSubtitle {
            constructor(properties?: synctv.client.IPlaybackSubtitle);
            public name: string;
            public language: string;
            public url: string;
            public headers: { [k: string]: string };
            public format: string;
            public expireAt?: (number|Long|null);
            public p2pDelivery?: (synctv.client.IP2pResourceDelivery|null);
            public _expireAt?: "expireAt";
            public _p2pDelivery?: "p2pDelivery";
            public static encode(message: synctv.client.IPlaybackSubtitle, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackSubtitle;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaybackDanmakuDelivery {
            PLAYBACK_DANMAKU_DELIVERY_UNSPECIFIED = 0,
            PLAYBACK_DANMAKU_DELIVERY_DOCUMENT = 1,
            PLAYBACK_DANMAKU_DELIVERY_EVENT_STREAM = 2
        }

        interface IPlaybackDanmaku {
            name?: (string|null);
            url?: (string|null);
            format?: (string|null);
            headers?: ({ [k: string]: string }|null);
            expireAt?: (number|Long|null);
            p2pDelivery?: (synctv.client.IP2pResourceDelivery|null);
            delivery?: (synctv.client.PlaybackDanmakuDelivery|null);
        }

        class PlaybackDanmaku implements IPlaybackDanmaku {
            constructor(properties?: synctv.client.IPlaybackDanmaku);
            public name: string;
            public url: string;
            public format?: (string|null);
            public headers: { [k: string]: string };
            public expireAt?: (number|Long|null);
            public p2pDelivery?: (synctv.client.IP2pResourceDelivery|null);
            public delivery: synctv.client.PlaybackDanmakuDelivery;
            public _format?: "format";
            public _expireAt?: "expireAt";
            public _p2pDelivery?: "p2pDelivery";
            public static encode(message: synctv.client.IPlaybackDanmaku, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackDanmaku;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackInfo {
            thumbnail?: (string|null);
            medias?: (synctv.client.IPlaybackMedia[]|null);
            defaultMediaIndex?: (number|null);
            subtitles?: (synctv.client.IPlaybackSubtitle[]|null);
            defaultSubtitleIndex?: (number|null);
            danmakus?: (synctv.client.IPlaybackDanmaku[]|null);
            defaultDanmakuIndex?: (number|null);
        }

        class PlaybackInfo implements IPlaybackInfo {
            constructor(properties?: synctv.client.IPlaybackInfo);
            public thumbnail?: (string|null);
            public medias: synctv.client.IPlaybackMedia[];
            public defaultMediaIndex?: (number|null);
            public subtitles: synctv.client.IPlaybackSubtitle[];
            public defaultSubtitleIndex?: (number|null);
            public danmakus: synctv.client.IPlaybackDanmaku[];
            public defaultDanmakuIndex?: (number|null);
            public _thumbnail?: "thumbnail";
            public _defaultMediaIndex?: "defaultMediaIndex";
            public _defaultSubtitleIndex?: "defaultSubtitleIndex";
            public _defaultDanmakuIndex?: "defaultDanmakuIndex";
            public static encode(message: synctv.client.IPlaybackInfo, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackInfo;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAlistTranscodingTaskMetadata {
            modeName?: (string|null);
            templateId?: (string|null);
            templateName?: (string|null);
            templateWidth?: (number|Long|null);
            templateHeight?: (number|Long|null);
            stage?: (string|null);
            status?: (string|null);
        }

        class AlistTranscodingTaskMetadata implements IAlistTranscodingTaskMetadata {
            constructor(properties?: synctv.client.IAlistTranscodingTaskMetadata);
            public modeName: string;
            public templateId: string;
            public templateName: string;
            public templateWidth: (number|Long);
            public templateHeight: (number|Long);
            public stage: string;
            public status: string;
            public static encode(message: synctv.client.IAlistTranscodingTaskMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.AlistTranscodingTaskMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAlistVideoPreviewMetadata {
            driveId?: (string|null);
            fileId?: (string|null);
            provider?: (string|null);
            category?: (string|null);
            transcodingCount?: (number|Long|null);
            subtitleCount?: (number|Long|null);
        }

        class AlistVideoPreviewMetadata implements IAlistVideoPreviewMetadata {
            constructor(properties?: synctv.client.IAlistVideoPreviewMetadata);
            public driveId?: (string|null);
            public fileId?: (string|null);
            public provider?: (string|null);
            public category?: (string|null);
            public transcodingCount: (number|Long);
            public subtitleCount: (number|Long);
            public _driveId?: "driveId";
            public _fileId?: "fileId";
            public _provider?: "provider";
            public _category?: "category";
            public static encode(message: synctv.client.IAlistVideoPreviewMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.AlistVideoPreviewMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAlistPlaybackMetadata {
            name?: (string|null);
            size?: (number|Long|null);
            provider?: (string|null);
            externalSubtitleCount?: (number|null);
            videoPreviewError?: (string|null);
            transcodingTasks?: (synctv.client.IAlistTranscodingTaskMetadata[]|null);
            videoPreview?: (synctv.client.IAlistVideoPreviewMetadata|null);
            width?: (number|Long|null);
            height?: (number|Long|null);
        }

        class AlistPlaybackMetadata implements IAlistPlaybackMetadata {
            constructor(properties?: synctv.client.IAlistPlaybackMetadata);
            public name?: (string|null);
            public size?: (number|Long|null);
            public provider?: (string|null);
            public externalSubtitleCount?: (number|null);
            public videoPreviewError?: (string|null);
            public transcodingTasks: synctv.client.IAlistTranscodingTaskMetadata[];
            public videoPreview?: (synctv.client.IAlistVideoPreviewMetadata|null);
            public width?: (number|Long|null);
            public height?: (number|Long|null);
            public _name?: "name";
            public _size?: "size";
            public _provider?: "provider";
            public _externalSubtitleCount?: "externalSubtitleCount";
            public _videoPreviewError?: "videoPreviewError";
            public _videoPreview?: "videoPreview";
            public _width?: "width";
            public _height?: "height";
            public static encode(message: synctv.client.IAlistPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.AlistPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum BilibiliPlaybackKind {
            BILIBILI_PLAYBACK_KIND_UNSPECIFIED = 0,
            BILIBILI_PLAYBACK_KIND_VIDEO = 1,
            BILIBILI_PLAYBACK_KIND_PGC = 2,
            BILIBILI_PLAYBACK_KIND_LIVE = 3
        }

        interface IBilibiliPlaybackMetadata {
            kind?: (synctv.client.BilibiliPlaybackKind|null);
            bvid?: (string|null);
            aid?: (number|Long|null);
            epid?: (number|Long|null);
            cid?: (number|Long|null);
            minBufferTime?: (number|null);
            fallbackFormat?: (string|null);
            quality?: (number|Long|null);
            roomId?: (number|Long|null);
            liveStartedAt?: (number|Long|null);
            isLive?: (boolean|null);
            isCurrentlyLive?: (boolean|null);
        }

        class BilibiliPlaybackMetadata implements IBilibiliPlaybackMetadata {
            constructor(properties?: synctv.client.IBilibiliPlaybackMetadata);
            public kind: synctv.client.BilibiliPlaybackKind;
            public bvid?: (string|null);
            public aid?: (number|Long|null);
            public epid?: (number|Long|null);
            public cid?: (number|Long|null);
            public minBufferTime?: (number|null);
            public fallbackFormat?: (string|null);
            public quality?: (number|Long|null);
            public roomId?: (number|Long|null);
            public liveStartedAt?: (number|Long|null);
            public isLive: boolean;
            public isCurrentlyLive?: (boolean|null);
            public _bvid?: "bvid";
            public _aid?: "aid";
            public _epid?: "epid";
            public _cid?: "cid";
            public _minBufferTime?: "minBufferTime";
            public _fallbackFormat?: "fallbackFormat";
            public _quality?: "quality";
            public _roomId?: "roomId";
            public _liveStartedAt?: "liveStartedAt";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.IBilibiliPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.BilibiliPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum EmbyPlaybackKind {
            EMBY_PLAYBACK_KIND_UNSPECIFIED = 0,
            EMBY_PLAYBACK_KIND_MOVIE = 1,
            EMBY_PLAYBACK_KIND_EPISODE = 2,
            EMBY_PLAYBACK_KIND_VIDEO = 3,
            EMBY_PLAYBACK_KIND_AUDIO = 4,
            EMBY_PLAYBACK_KIND_MUSIC_ALBUM = 5
        }

        interface IEmbyPlaybackMetadata {
            kind?: (synctv.client.EmbyPlaybackKind|null);
            seriesName?: (string|null);
            seasonName?: (string|null);
            playSessionId?: (string|null);
        }

        class EmbyPlaybackMetadata implements IEmbyPlaybackMetadata {
            constructor(properties?: synctv.client.IEmbyPlaybackMetadata);
            public kind: synctv.client.EmbyPlaybackKind;
            public seriesName?: (string|null);
            public seasonName?: (string|null);
            public playSessionId?: (string|null);
            public _seriesName?: "seriesName";
            public _seasonName?: "seasonName";
            public _playSessionId?: "playSessionId";
            public static encode(message: synctv.client.IEmbyPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.EmbyPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDirectUrlPlaybackMetadata {
            format?: (string|null);
            filename?: (string|null);
        }

        class DirectUrlPlaybackMetadata implements IDirectUrlPlaybackMetadata {
            constructor(properties?: synctv.client.IDirectUrlPlaybackMetadata);
            public format?: (string|null);
            public filename?: (string|null);
            public _format?: "format";
            public _filename?: "filename";
            public static encode(message: synctv.client.IDirectUrlPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.DirectUrlPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ILiveProxyPlaybackMetadata {
            mediaId?: (string|null);
            roomId?: (string|null);
            sourceHost?: (string|null);
        }

        class LiveProxyPlaybackMetadata implements ILiveProxyPlaybackMetadata {
            constructor(properties?: synctv.client.ILiveProxyPlaybackMetadata);
            public mediaId: string;
            public roomId: string;
            public sourceHost?: (string|null);
            public _sourceHost?: "sourceHost";
            public static encode(message: synctv.client.ILiveProxyPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.LiveProxyPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum LiveStreamAvailability {
            LIVE_STREAM_AVAILABILITY_UNSPECIFIED = 0,
            LIVE_STREAM_AVAILABILITY_OFFLINE = 1,
            LIVE_STREAM_AVAILABILITY_LIVE = 2
        }

        interface ILivePlaybackMetadata {
            mediaId?: (string|null);
            roomId?: (string|null);
            availability?: (synctv.client.LiveStreamAvailability|null);
            streamGenerationId?: (string|null);
        }

        class LivePlaybackMetadata implements ILivePlaybackMetadata {
            constructor(properties?: synctv.client.ILivePlaybackMetadata);
            public mediaId: string;
            public roomId: string;
            public availability: synctv.client.LiveStreamAvailability;
            public streamGenerationId: string;
            public static encode(message: synctv.client.ILivePlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.LivePlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITwitchChapterMetadata {
            title?: (string|null);
            startSeconds?: (number|Long|null);
            endSeconds?: (number|Long|null);
        }

        class TwitchChapterMetadata implements ITwitchChapterMetadata {
            constructor(properties?: synctv.client.ITwitchChapterMetadata);
            public title: string;
            public startSeconds: (number|Long);
            public endSeconds: (number|Long);
            public static encode(message: synctv.client.ITwitchChapterMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TwitchChapterMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITwitchPlaybackMetadata {
            resourceId?: (string|null);
            title?: (string|null);
            author?: (string|null);
            category?: (string|null);
            thumbnailUrl?: (string|null);
            description?: (string|null);
            viewCount?: (number|Long|null);
            publishedAt?: (string|null);
            chapters?: (synctv.client.ITwitchChapterMetadata[]|null);
            storyboardUrl?: (string|null);
            isLive?: (boolean|null);
            isCurrentlyLive?: (boolean|null);
        }

        class TwitchPlaybackMetadata implements ITwitchPlaybackMetadata {
            constructor(properties?: synctv.client.ITwitchPlaybackMetadata);
            public resourceId: string;
            public title: string;
            public author: string;
            public category?: (string|null);
            public thumbnailUrl?: (string|null);
            public description?: (string|null);
            public viewCount?: (number|Long|null);
            public publishedAt?: (string|null);
            public chapters: synctv.client.ITwitchChapterMetadata[];
            public storyboardUrl?: (string|null);
            public isLive: boolean;
            public isCurrentlyLive?: (boolean|null);
            public _category?: "category";
            public _thumbnailUrl?: "thumbnailUrl";
            public _description?: "description";
            public _viewCount?: "viewCount";
            public _publishedAt?: "publishedAt";
            public _storyboardUrl?: "storyboardUrl";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.ITwitchPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TwitchPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IYoutubePlaybackMetadata {
            videoId?: (string|null);
            channelId?: (string|null);
            channelName?: (string|null);
            description?: (string|null);
            viewCount?: (number|Long|null);
            publishDate?: (string|null);
            uploadDate?: (string|null);
            category?: (string|null);
            isLive?: (boolean|null);
            liveStart?: (string|null);
            liveEnd?: (string|null);
            storyboardSpec?: (string|null);
            automaticCaptionCount?: (number|null);
            manualCaptionCount?: (number|null);
            translationLanguages?: (string[]|null);
            isCurrentlyLive?: (boolean|null);
        }

        class YoutubePlaybackMetadata implements IYoutubePlaybackMetadata {
            constructor(properties?: synctv.client.IYoutubePlaybackMetadata);
            public videoId: string;
            public channelId: string;
            public channelName: string;
            public description: string;
            public viewCount?: (number|Long|null);
            public publishDate?: (string|null);
            public uploadDate?: (string|null);
            public category?: (string|null);
            public isLive: boolean;
            public liveStart?: (string|null);
            public liveEnd?: (string|null);
            public storyboardSpec?: (string|null);
            public automaticCaptionCount: number;
            public manualCaptionCount: number;
            public translationLanguages: string[];
            public isCurrentlyLive?: (boolean|null);
            public _viewCount?: "viewCount";
            public _publishDate?: "publishDate";
            public _uploadDate?: "uploadDate";
            public _category?: "category";
            public _liveStart?: "liveStart";
            public _liveEnd?: "liveEnd";
            public _storyboardSpec?: "storyboardSpec";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.IYoutubePlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.YoutubePlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum DouyinPlaybackKind {
            DOUYIN_PLAYBACK_KIND_UNSPECIFIED = 0,
            DOUYIN_PLAYBACK_KIND_VIDEO = 1,
            DOUYIN_PLAYBACK_KIND_LIVE = 2
        }

        interface IDouyinPlaybackMetadata {
            id?: (string|null);
            kind?: (synctv.client.DouyinPlaybackKind|null);
            authorId?: (string|null);
            authorSecUid?: (string|null);
            authorName?: (string|null);
            description?: (string|null);
            viewCount?: (number|Long|null);
            likeCount?: (number|Long|null);
            commentCount?: (number|Long|null);
            shareCount?: (number|Long|null);
            collectCount?: (number|Long|null);
            createdAt?: (number|Long|null);
            musicTitle?: (string|null);
            musicAuthor?: (string|null);
            isLive?: (boolean|null);
            roomId?: (string|null);
            isCurrentlyLive?: (boolean|null);
        }

        class DouyinPlaybackMetadata implements IDouyinPlaybackMetadata {
            constructor(properties?: synctv.client.IDouyinPlaybackMetadata);
            public id: string;
            public kind: synctv.client.DouyinPlaybackKind;
            public authorId: string;
            public authorSecUid: string;
            public authorName: string;
            public description: string;
            public viewCount?: (number|Long|null);
            public likeCount?: (number|Long|null);
            public commentCount?: (number|Long|null);
            public shareCount?: (number|Long|null);
            public collectCount?: (number|Long|null);
            public createdAt?: (number|Long|null);
            public musicTitle?: (string|null);
            public musicAuthor?: (string|null);
            public isLive: boolean;
            public roomId?: (string|null);
            public isCurrentlyLive?: (boolean|null);
            public _viewCount?: "viewCount";
            public _likeCount?: "likeCount";
            public _commentCount?: "commentCount";
            public _shareCount?: "shareCount";
            public _collectCount?: "collectCount";
            public _createdAt?: "createdAt";
            public _musicTitle?: "musicTitle";
            public _musicAuthor?: "musicAuthor";
            public _roomId?: "roomId";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.IDouyinPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.DouyinPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum TikTokPlaybackKind {
            TIK_TOK_PLAYBACK_KIND_UNSPECIFIED = 0,
            TIK_TOK_PLAYBACK_KIND_VIDEO = 1,
            TIK_TOK_PLAYBACK_KIND_LIVE = 2
        }

        interface ITikTokPlaybackMetadata {
            id?: (string|null);
            kind?: (synctv.client.TikTokPlaybackKind|null);
            authorId?: (string|null);
            authorSecUid?: (string|null);
            authorUniqueId?: (string|null);
            authorName?: (string|null);
            description?: (string|null);
            viewCount?: (number|Long|null);
            likeCount?: (number|Long|null);
            commentCount?: (number|Long|null);
            shareCount?: (number|Long|null);
            collectCount?: (number|Long|null);
            concurrentViewers?: (number|Long|null);
            createdAt?: (number|Long|null);
            musicTitle?: (string|null);
            musicAuthor?: (string|null);
            subtitleCount?: (number|null);
            isLive?: (boolean|null);
            roomId?: (string|null);
            isCurrentlyLive?: (boolean|null);
        }

        class TikTokPlaybackMetadata implements ITikTokPlaybackMetadata {
            constructor(properties?: synctv.client.ITikTokPlaybackMetadata);
            public id: string;
            public kind: synctv.client.TikTokPlaybackKind;
            public authorId: string;
            public authorSecUid: string;
            public authorUniqueId: string;
            public authorName: string;
            public description: string;
            public viewCount?: (number|Long|null);
            public likeCount?: (number|Long|null);
            public commentCount?: (number|Long|null);
            public shareCount?: (number|Long|null);
            public collectCount?: (number|Long|null);
            public concurrentViewers?: (number|Long|null);
            public createdAt?: (number|Long|null);
            public musicTitle?: (string|null);
            public musicAuthor?: (string|null);
            public subtitleCount: number;
            public isLive: boolean;
            public roomId?: (string|null);
            public isCurrentlyLive?: (boolean|null);
            public _viewCount?: "viewCount";
            public _likeCount?: "likeCount";
            public _commentCount?: "commentCount";
            public _shareCount?: "shareCount";
            public _collectCount?: "collectCount";
            public _concurrentViewers?: "concurrentViewers";
            public _createdAt?: "createdAt";
            public _musicTitle?: "musicTitle";
            public _musicAuthor?: "musicAuthor";
            public _roomId?: "roomId";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.ITikTokPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TikTokPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHuyaPlaybackMetadata {
            resourceId?: (string|null);
            title?: (string|null);
            author?: (string|null);
            authorId?: (string|null);
            category?: (string|null);
            thumbnailUrl?: (string|null);
            avatarUrl?: (string|null);
            description?: (string|null);
            viewCount?: (number|Long|null);
            commentCount?: (number|Long|null);
            likeCount?: (number|Long|null);
            publishedAt?: (number|Long|null);
            isLive?: (boolean|null);
            isCurrentlyLive?: (boolean|null);
        }

        class HuyaPlaybackMetadata implements IHuyaPlaybackMetadata {
            constructor(properties?: synctv.client.IHuyaPlaybackMetadata);
            public resourceId: string;
            public title: string;
            public author: string;
            public authorId?: (string|null);
            public category?: (string|null);
            public thumbnailUrl?: (string|null);
            public avatarUrl?: (string|null);
            public description?: (string|null);
            public viewCount?: (number|Long|null);
            public commentCount?: (number|Long|null);
            public likeCount?: (number|Long|null);
            public publishedAt?: (number|Long|null);
            public isLive: boolean;
            public isCurrentlyLive?: (boolean|null);
            public _authorId?: "authorId";
            public _category?: "category";
            public _thumbnailUrl?: "thumbnailUrl";
            public _avatarUrl?: "avatarUrl";
            public _description?: "description";
            public _viewCount?: "viewCount";
            public _commentCount?: "commentCount";
            public _likeCount?: "likeCount";
            public _publishedAt?: "publishedAt";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.IHuyaPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.HuyaPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDouyuPlaybackMetadata {
            roomId?: (string|null);
            title?: (string|null);
            author?: (string|null);
            category?: (string|null);
            thumbnailUrl?: (string|null);
            avatarUrl?: (string|null);
            isReplay?: (boolean|null);
            isVip?: (boolean|null);
            viewerCount?: (number|Long|null);
            startedAt?: (string|null);
            isLive?: (boolean|null);
            isCurrentlyLive?: (boolean|null);
        }

        class DouyuPlaybackMetadata implements IDouyuPlaybackMetadata {
            constructor(properties?: synctv.client.IDouyuPlaybackMetadata);
            public roomId: string;
            public title: string;
            public author: string;
            public category?: (string|null);
            public thumbnailUrl?: (string|null);
            public avatarUrl?: (string|null);
            public isReplay: boolean;
            public isVip: boolean;
            public viewerCount?: (number|Long|null);
            public startedAt?: (string|null);
            public isLive: boolean;
            public isCurrentlyLive?: (boolean|null);
            public _category?: "category";
            public _thumbnailUrl?: "thumbnailUrl";
            public _avatarUrl?: "avatarUrl";
            public _viewerCount?: "viewerCount";
            public _startedAt?: "startedAt";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.IDouyuPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.DouyuPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAcFunPlaybackMetadata {
            resourceId?: (string|null);
            title?: (string|null);
            author?: (string|null);
            authorId?: (string|null);
            category?: (string|null);
            thumbnailUrl?: (string|null);
            avatarUrl?: (string|null);
            description?: (string|null);
            tags?: (string[]|null);
            viewCount?: (number|Long|null);
            likeCount?: (number|Long|null);
            commentCount?: (number|Long|null);
            publishedAt?: (number|Long|null);
            startedAt?: (number|Long|null);
            isLive?: (boolean|null);
            isCurrentlyLive?: (boolean|null);
        }

        class AcFunPlaybackMetadata implements IAcFunPlaybackMetadata {
            constructor(properties?: synctv.client.IAcFunPlaybackMetadata);
            public resourceId: string;
            public title: string;
            public author: string;
            public authorId?: (string|null);
            public category?: (string|null);
            public thumbnailUrl?: (string|null);
            public avatarUrl?: (string|null);
            public description?: (string|null);
            public tags: string[];
            public viewCount?: (number|Long|null);
            public likeCount?: (number|Long|null);
            public commentCount?: (number|Long|null);
            public publishedAt?: (number|Long|null);
            public startedAt?: (number|Long|null);
            public isLive: boolean;
            public isCurrentlyLive?: (boolean|null);
            public _authorId?: "authorId";
            public _category?: "category";
            public _thumbnailUrl?: "thumbnailUrl";
            public _avatarUrl?: "avatarUrl";
            public _description?: "description";
            public _viewCount?: "viewCount";
            public _likeCount?: "likeCount";
            public _commentCount?: "commentCount";
            public _publishedAt?: "publishedAt";
            public _startedAt?: "startedAt";
            public _isCurrentlyLive?: "isCurrentlyLive";
            public static encode(message: synctv.client.IAcFunPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.AcFunPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICctvChapterMetadata {
            id?: (string|null);
            title?: (string|null);
            startMs?: (number|Long|null);
            endMs?: (number|Long|null);
        }

        class CctvChapterMetadata implements ICctvChapterMetadata {
            constructor(properties?: synctv.client.ICctvChapterMetadata);
            public id: string;
            public title: string;
            public startMs: (number|Long);
            public endMs: (number|Long);
            public static encode(message: synctv.client.ICctvChapterMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.CctvChapterMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICctvPlaybackMetadata {
            videoId?: (string|null);
            title?: (string|null);
            description?: (string|null);
            uploader?: (string|null);
            producer?: (string|null);
            channel?: (string|null);
            column?: (string|null);
            tags?: (string[]|null);
            thumbnailUrl?: (string|null);
            publishedAt?: (number|Long|null);
            chapters?: (synctv.client.ICctvChapterMetadata[]|null);
            "protected"?: (boolean|null);
        }

        class CctvPlaybackMetadata implements ICctvPlaybackMetadata {
            constructor(properties?: synctv.client.ICctvPlaybackMetadata);
            public videoId: string;
            public title: string;
            public description?: (string|null);
            public uploader?: (string|null);
            public producer?: (string|null);
            public channel?: (string|null);
            public column?: (string|null);
            public tags: string[];
            public thumbnailUrl?: (string|null);
            public publishedAt?: (number|Long|null);
            public chapters: synctv.client.ICctvChapterMetadata[];
            public protected: boolean;
            public _description?: "description";
            public _uploader?: "uploader";
            public _producer?: "producer";
            public _channel?: "channel";
            public _column?: "column";
            public _thumbnailUrl?: "thumbnailUrl";
            public _publishedAt?: "publishedAt";
            public static encode(message: synctv.client.ICctvPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.CctvPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosFilePlaybackMetadata {
            name?: (string|null);
            path?: (string|null);
            size?: (number|Long|null);
            modifiedAt?: (number|Long|null);
        }

        class FnosFilePlaybackMetadata implements IFnosFilePlaybackMetadata {
            constructor(properties?: synctv.client.IFnosFilePlaybackMetadata);
            public name: string;
            public path: string;
            public size?: (number|Long|null);
            public modifiedAt?: (number|Long|null);
            public _size?: "size";
            public _modifiedAt?: "modifiedAt";
            public static encode(message: synctv.client.IFnosFilePlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosFilePlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosAudioTrackMetadata {
            guid?: (string|null);
            title?: (string|null);
            language?: (string|null);
            codec?: (string|null);
            channels?: (number|null);
            bitrate?: (number|Long|null);
            isDefault?: (boolean|null);
        }

        class FnosAudioTrackMetadata implements IFnosAudioTrackMetadata {
            constructor(properties?: synctv.client.IFnosAudioTrackMetadata);
            public guid?: (string|null);
            public title?: (string|null);
            public language?: (string|null);
            public codec?: (string|null);
            public channels: number;
            public bitrate: (number|Long);
            public isDefault: boolean;
            public _guid?: "guid";
            public _title?: "title";
            public _language?: "language";
            public _codec?: "codec";
            public static encode(message: synctv.client.IFnosAudioTrackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosAudioTrackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosSubtitleTrackMetadata {
            guid?: (string|null);
            title?: (string|null);
            language?: (string|null);
            codec?: (string|null);
            format?: (string|null);
            external?: (boolean|null);
            isDefault?: (boolean|null);
            forced?: (boolean|null);
        }

        class FnosSubtitleTrackMetadata implements IFnosSubtitleTrackMetadata {
            constructor(properties?: synctv.client.IFnosSubtitleTrackMetadata);
            public guid?: (string|null);
            public title?: (string|null);
            public language?: (string|null);
            public codec?: (string|null);
            public format?: (string|null);
            public external: boolean;
            public isDefault: boolean;
            public forced: boolean;
            public _guid?: "guid";
            public _title?: "title";
            public _language?: "language";
            public _codec?: "codec";
            public _format?: "format";
            public static encode(message: synctv.client.IFnosSubtitleTrackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosSubtitleTrackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosMediaPlaybackMetadata {
            itemGuid?: (string|null);
            mediaGuid?: (string|null);
            title?: (string|null);
            overview?: (string|null);
            posterUrl?: (string|null);
            backdropUrl?: (string|null);
            width?: (number|null);
            height?: (number|null);
            videoCodec?: (string|null);
            videoProfile?: (string|null);
            bitDepth?: (number|null);
            dolbyVisionProfile?: (number|null);
            frameRate?: (string|null);
            seasonNumber?: (number|null);
            episodeNumber?: (number|null);
            progressSeconds?: (number|Long|null);
            durationSeconds?: (number|Long|null);
            watched?: (boolean|null);
            audioTracks?: (synctv.client.IFnosAudioTrackMetadata[]|null);
            subtitleTracks?: (synctv.client.IFnosSubtitleTrackMetadata[]|null);
        }

        class FnosMediaPlaybackMetadata implements IFnosMediaPlaybackMetadata {
            constructor(properties?: synctv.client.IFnosMediaPlaybackMetadata);
            public itemGuid: string;
            public mediaGuid: string;
            public title: string;
            public overview?: (string|null);
            public posterUrl?: (string|null);
            public backdropUrl?: (string|null);
            public width?: (number|null);
            public height?: (number|null);
            public videoCodec?: (string|null);
            public videoProfile?: (string|null);
            public bitDepth?: (number|null);
            public dolbyVisionProfile?: (number|null);
            public frameRate?: (string|null);
            public seasonNumber?: (number|null);
            public episodeNumber?: (number|null);
            public progressSeconds: (number|Long);
            public durationSeconds: (number|Long);
            public watched: boolean;
            public audioTracks: synctv.client.IFnosAudioTrackMetadata[];
            public subtitleTracks: synctv.client.IFnosSubtitleTrackMetadata[];
            public _overview?: "overview";
            public _posterUrl?: "posterUrl";
            public _backdropUrl?: "backdropUrl";
            public _width?: "width";
            public _height?: "height";
            public _videoCodec?: "videoCodec";
            public _videoProfile?: "videoProfile";
            public _bitDepth?: "bitDepth";
            public _dolbyVisionProfile?: "dolbyVisionProfile";
            public _frameRate?: "frameRate";
            public _seasonNumber?: "seasonNumber";
            public _episodeNumber?: "episodeNumber";
            public static encode(message: synctv.client.IFnosMediaPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosMediaPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosPlaybackMetadata {
            file?: (synctv.client.IFnosFilePlaybackMetadata|null);
            media?: (synctv.client.IFnosMediaPlaybackMetadata|null);
        }

        class FnosPlaybackMetadata implements IFnosPlaybackMetadata {
            constructor(properties?: synctv.client.IFnosPlaybackMetadata);
            public file?: (synctv.client.IFnosFilePlaybackMetadata|null);
            public media?: (synctv.client.IFnosMediaPlaybackMetadata|null);
            public kind?: ("file"|"media");
            public static encode(message: synctv.client.IFnosPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FnosPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IQnapPlaybackMetadata {
            name?: (string|null);
            path?: (string|null);
            size?: (number|Long|null);
            modifiedAt?: (number|Long|null);
            fileType?: (number|Long|null);
            realtimeTranscode?: (boolean|null);
            hardwareTranscode?: (boolean|null);
            multimediaCodec?: (boolean|null);
            preTranscodedHeights?: (number[]|null);
            realtimeHeights?: (number[]|null);
        }

        class QnapPlaybackMetadata implements IQnapPlaybackMetadata {
            constructor(properties?: synctv.client.IQnapPlaybackMetadata);
            public name: string;
            public path: string;
            public size: (number|Long);
            public modifiedAt: (number|Long);
            public fileType: (number|Long);
            public realtimeTranscode: boolean;
            public hardwareTranscode: boolean;
            public multimediaCodec: boolean;
            public preTranscodedHeights: number[];
            public realtimeHeights: number[];
            public static encode(message: synctv.client.IQnapPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.QnapPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyAudioTrackMetadata {
            id?: (number|Long|null);
            language?: (string|null);
            codec?: (string|null);
            channels?: (number|null);
            bitrate?: (number|Long|null);
            isDefault?: (boolean|null);
        }

        class SynologyAudioTrackMetadata implements ISynologyAudioTrackMetadata {
            constructor(properties?: synctv.client.ISynologyAudioTrackMetadata);
            public id: (number|Long);
            public language: string;
            public codec: string;
            public channels: number;
            public bitrate: (number|Long);
            public isDefault: boolean;
            public static encode(message: synctv.client.ISynologyAudioTrackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologyAudioTrackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologySubtitleMetadata {
            id?: (string|null);
            language?: (string|null);
            title?: (string|null);
            format?: (string|null);
            embedded?: (boolean|null);
        }

        class SynologySubtitleMetadata implements ISynologySubtitleMetadata {
            constructor(properties?: synctv.client.ISynologySubtitleMetadata);
            public id: string;
            public language: string;
            public title: string;
            public format: string;
            public embedded: boolean;
            public static encode(message: synctv.client.ISynologySubtitleMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologySubtitleMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyPlaybackMetadata {
            title?: (string|null);
            summary?: (string|null);
            tagline?: (string|null);
            certificate?: (string|null);
            rating?: (number|null);
            actors?: (string[]|null);
            directors?: (string[]|null);
            writers?: (string[]|null);
            genres?: (string[]|null);
            itemId?: (number|Long|null);
            fileId?: (number|Long|null);
            kind?: (synctv.source_config.SynologyLibraryItemKind|null);
            path?: (string|null);
            size?: (number|Long|null);
            durationSeconds?: (number|Long|null);
            progressSeconds?: (number|Long|null);
            width?: (number|null);
            height?: (number|null);
            videoCodec?: (string|null);
            audioCodec?: (string|null);
            container?: (string|null);
            videoBitrate?: (number|Long|null);
            audioBitrate?: (number|Long|null);
            frameRateNumerator?: (number|Long|null);
            frameRateDenominator?: (number|Long|null);
            audioChannels?: (number|null);
            audioFrequencyHz?: (number|null);
            posterUrl?: (string|null);
            backdropUrl?: (string|null);
            watched?: (boolean|null);
            watchedRatio?: (number|null);
            parentalControlled?: (boolean|null);
            createTime?: (number|Long|null);
            lastWatched?: (number|Long|null);
            audioTracks?: (synctv.client.ISynologyAudioTrackMetadata[]|null);
            subtitles?: (synctv.client.ISynologySubtitleMetadata[]|null);
        }

        class SynologyPlaybackMetadata implements ISynologyPlaybackMetadata {
            constructor(properties?: synctv.client.ISynologyPlaybackMetadata);
            public title: string;
            public summary: string;
            public tagline: string;
            public certificate: string;
            public rating: number;
            public actors: string[];
            public directors: string[];
            public writers: string[];
            public genres: string[];
            public itemId: (number|Long);
            public fileId: (number|Long);
            public kind: synctv.source_config.SynologyLibraryItemKind;
            public path: string;
            public size: (number|Long);
            public durationSeconds: (number|Long);
            public progressSeconds: (number|Long);
            public width: number;
            public height: number;
            public videoCodec: string;
            public audioCodec: string;
            public container: string;
            public videoBitrate: (number|Long);
            public audioBitrate: (number|Long);
            public frameRateNumerator: (number|Long);
            public frameRateDenominator: (number|Long);
            public audioChannels: number;
            public audioFrequencyHz: number;
            public posterUrl?: (string|null);
            public backdropUrl?: (string|null);
            public watched: boolean;
            public watchedRatio: number;
            public parentalControlled: boolean;
            public createTime: (number|Long);
            public lastWatched: (number|Long);
            public audioTracks: synctv.client.ISynologyAudioTrackMetadata[];
            public subtitles: synctv.client.ISynologySubtitleMetadata[];
            public _posterUrl?: "posterUrl";
            public _backdropUrl?: "backdropUrl";
            public static encode(message: synctv.client.ISynologyPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SynologyPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudPlaybackMetadata {
            fileId?: (number|Long|null);
            name?: (string|null);
            path?: (string|null);
            size?: (number|Long|null);
            modifiedAt?: (string|null);
            contentType?: (string|null);
            etag?: (string|null);
            permissions?: (string|null);
            ownerId?: (string|null);
            ownerDisplayName?: (string|null);
            favorite?: (boolean|null);
            hasPreview?: (boolean|null);
            blurhash?: (string|null);
            width?: (number|null);
            height?: (number|null);
            durationMillis?: (number|Long|null);
        }

        class NextcloudPlaybackMetadata implements INextcloudPlaybackMetadata {
            constructor(properties?: synctv.client.INextcloudPlaybackMetadata);
            public fileId: (number|Long);
            public name: string;
            public path: string;
            public size: (number|Long);
            public modifiedAt?: (string|null);
            public contentType?: (string|null);
            public etag?: (string|null);
            public permissions?: (string|null);
            public ownerId?: (string|null);
            public ownerDisplayName?: (string|null);
            public favorite: boolean;
            public hasPreview: boolean;
            public blurhash?: (string|null);
            public width?: (number|null);
            public height?: (number|null);
            public durationMillis?: (number|Long|null);
            public _modifiedAt?: "modifiedAt";
            public _contentType?: "contentType";
            public _etag?: "etag";
            public _permissions?: "permissions";
            public _ownerId?: "ownerId";
            public _ownerDisplayName?: "ownerDisplayName";
            public _blurhash?: "blurhash";
            public _width?: "width";
            public _height?: "height";
            public _durationMillis?: "durationMillis";
            public static encode(message: synctv.client.INextcloudPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.NextcloudPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafilePlaybackMetadata {
            repositoryId?: (string|null);
            objectId?: (string|null);
            name?: (string|null);
            path?: (string|null);
            size?: (number|Long|null);
            modifiedAt?: (string|null);
            isLocked?: (boolean|null);
            canPreview?: (boolean|null);
            canEdit?: (boolean|null);
            hasThumbnail?: (boolean|null);
        }

        class SeafilePlaybackMetadata implements ISeafilePlaybackMetadata {
            constructor(properties?: synctv.client.ISeafilePlaybackMetadata);
            public repositoryId: string;
            public objectId: string;
            public name: string;
            public path: string;
            public size: (number|Long);
            public modifiedAt: string;
            public isLocked: boolean;
            public canPreview: boolean;
            public canEdit: boolean;
            public hasThumbnail: boolean;
            public static encode(message: synctv.client.ISeafilePlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.SeafilePlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITrueNasPlaybackMetadata {
            realpath?: (string|null);
            size?: (number|Long|null);
            allocationSize?: (number|Long|null);
            mode?: (number|null);
            mountId?: (number|Long|null);
            uid?: (number|null);
            gid?: (number|null);
            atime?: (number|null);
            mtime?: (number|null);
            ctime?: (number|null);
            btime?: (number|null);
            dev?: (number|Long|null);
            inode?: (number|Long|null);
            nlink?: (number|Long|null);
            acl?: (boolean|null);
            isMountpoint?: (boolean|null);
            isCtldir?: (boolean|null);
            attributes?: (string[]|null);
            user?: (string|null);
            group?: (string|null);
        }

        class TrueNasPlaybackMetadata implements ITrueNasPlaybackMetadata {
            constructor(properties?: synctv.client.ITrueNasPlaybackMetadata);
            public realpath: string;
            public size: (number|Long);
            public allocationSize: (number|Long);
            public mode: number;
            public mountId: (number|Long);
            public uid: number;
            public gid: number;
            public atime: number;
            public mtime: number;
            public ctime: number;
            public btime: number;
            public dev: (number|Long);
            public inode: (number|Long);
            public nlink: (number|Long);
            public acl: boolean;
            public isMountpoint: boolean;
            public isCtldir: boolean;
            public attributes: string[];
            public user?: (string|null);
            public group?: (string|null);
            public _user?: "user";
            public _group?: "group";
            public static encode(message: synctv.client.ITrueNasPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.TrueNasPlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackMetadata {
            alist?: (synctv.client.IAlistPlaybackMetadata|null);
            bilibili?: (synctv.client.IBilibiliPlaybackMetadata|null);
            emby?: (synctv.client.IEmbyPlaybackMetadata|null);
            directUrl?: (synctv.client.IDirectUrlPlaybackMetadata|null);
            liveProxy?: (synctv.client.ILiveProxyPlaybackMetadata|null);
            live?: (synctv.client.ILivePlaybackMetadata|null);
            twitch?: (synctv.client.ITwitchPlaybackMetadata|null);
            youtube?: (synctv.client.IYoutubePlaybackMetadata|null);
            douyin?: (synctv.client.IDouyinPlaybackMetadata|null);
            tiktok?: (synctv.client.ITikTokPlaybackMetadata|null);
            huya?: (synctv.client.IHuyaPlaybackMetadata|null);
            douyu?: (synctv.client.IDouyuPlaybackMetadata|null);
            acFun?: (synctv.client.IAcFunPlaybackMetadata|null);
            cctv?: (synctv.client.ICctvPlaybackMetadata|null);
            fnos?: (synctv.client.IFnosPlaybackMetadata|null);
            qnap?: (synctv.client.IQnapPlaybackMetadata|null);
            synology?: (synctv.client.ISynologyPlaybackMetadata|null);
            nextcloud?: (synctv.client.INextcloudPlaybackMetadata|null);
            seafile?: (synctv.client.ISeafilePlaybackMetadata|null);
            truenas?: (synctv.client.ITrueNasPlaybackMetadata|null);
        }

        class PlaybackMetadata implements IPlaybackMetadata {
            constructor(properties?: synctv.client.IPlaybackMetadata);
            public alist?: (synctv.client.IAlistPlaybackMetadata|null);
            public bilibili?: (synctv.client.IBilibiliPlaybackMetadata|null);
            public emby?: (synctv.client.IEmbyPlaybackMetadata|null);
            public directUrl?: (synctv.client.IDirectUrlPlaybackMetadata|null);
            public liveProxy?: (synctv.client.ILiveProxyPlaybackMetadata|null);
            public live?: (synctv.client.ILivePlaybackMetadata|null);
            public twitch?: (synctv.client.ITwitchPlaybackMetadata|null);
            public youtube?: (synctv.client.IYoutubePlaybackMetadata|null);
            public douyin?: (synctv.client.IDouyinPlaybackMetadata|null);
            public tiktok?: (synctv.client.ITikTokPlaybackMetadata|null);
            public huya?: (synctv.client.IHuyaPlaybackMetadata|null);
            public douyu?: (synctv.client.IDouyuPlaybackMetadata|null);
            public acFun?: (synctv.client.IAcFunPlaybackMetadata|null);
            public cctv?: (synctv.client.ICctvPlaybackMetadata|null);
            public fnos?: (synctv.client.IFnosPlaybackMetadata|null);
            public qnap?: (synctv.client.IQnapPlaybackMetadata|null);
            public synology?: (synctv.client.ISynologyPlaybackMetadata|null);
            public nextcloud?: (synctv.client.INextcloudPlaybackMetadata|null);
            public seafile?: (synctv.client.ISeafilePlaybackMetadata|null);
            public truenas?: (synctv.client.ITrueNasPlaybackMetadata|null);
            public metadata?: ("alist"|"bilibili"|"emby"|"directUrl"|"liveProxy"|"live"|"twitch"|"youtube"|"douyin"|"tiktok"|"huya"|"douyu"|"acFun"|"cctv"|"fnos"|"qnap"|"synology"|"nextcloud"|"seafile"|"truenas");
            public static encode(message: synctv.client.IPlaybackMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlayback {
            mediaId?: (string|null);
            playlistId?: (string|null);
            roomId?: (string|null);
            name?: (string|null);
            playlistPosition?: (number|null);
            provider?: (synctv.source_config.SourceProvider|null);
            providerInstanceName?: (string|null);
            playbackInfos?: ({ [k: string]: synctv.client.IPlaybackInfo }|null);
            defaultMode?: (string|null);
            metadata?: (synctv.client.IPlaybackMetadata|null);
            expiresAt?: (number|Long|null);
            durationSeconds?: (number|null);
            playbackKind?: (synctv.source_config.PlaybackKind|null);
            target?: (synctv.client.IProviderTarget|null);
        }

        class Playback implements IPlayback {
            constructor(properties?: synctv.client.IPlayback);
            public mediaId: string;
            public playlistId: string;
            public roomId: string;
            public name: string;
            public playlistPosition: number;
            public provider: synctv.source_config.SourceProvider;
            public providerInstanceName: string;
            public playbackInfos: { [k: string]: synctv.client.IPlaybackInfo };
            public defaultMode: string;
            public metadata?: (synctv.client.IPlaybackMetadata|null);
            public expiresAt?: (number|Long|null);
            public durationSeconds?: (number|null);
            public playbackKind: synctv.source_config.PlaybackKind;
            public target?: (synctv.client.IProviderTarget|null);
            public _metadata?: "metadata";
            public _expiresAt?: "expiresAt";
            public _durationSeconds?: "durationSeconds";
            public static encode(message: synctv.client.IPlayback, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.Playback;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlayMode {
            PLAY_MODE_UNSPECIFIED = 0,
            PLAY_MODE_SEQUENTIAL = 1,
            PLAY_MODE_REPEAT_ONE = 2,
            PLAY_MODE_REPEAT_ALL = 3,
            PLAY_MODE_SHUFFLE = 4
        }

        interface IAutoPlaySettings {
            enabled?: (boolean|null);
            mode?: (synctv.client.PlayMode|null);
            delay?: (number|null);
        }

        class AutoPlaySettings implements IAutoPlaySettings {
            constructor(properties?: synctv.client.IAutoPlaySettings);
            public enabled: boolean;
            public mode: synctv.client.PlayMode;
            public delay: number;
            public static encode(message: synctv.client.IAutoPlaySettings, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.AutoPlaySettings;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IRoomSettings {
            allowGuestJoin?: (boolean|null);
            maxMembers?: (number|Long|null);
            requireApproval?: (boolean|null);
            allowAutoJoin?: (boolean|null);
            chatEnabled?: (boolean|null);
            autoPlay?: (synctv.client.IAutoPlaySettings|null);
            adminAddedPermissions?: (number|Long|null);
            adminRemovedPermissions?: (number|Long|null);
            memberAddedPermissions?: (number|Long|null);
            memberRemovedPermissions?: (number|Long|null);
            guestAddedPermissions?: (number|Long|null);
            guestRemovedPermissions?: (number|Long|null);
            voiceChatEnabled?: (boolean|null);
            p2pMediaEnabled?: (boolean|null);
        }

        class RoomSettings implements IRoomSettings {
            constructor(properties?: synctv.client.IRoomSettings);
            public allowGuestJoin: boolean;
            public maxMembers: (number|Long);
            public requireApproval: boolean;
            public allowAutoJoin: boolean;
            public chatEnabled: boolean;
            public autoPlay?: (synctv.client.IAutoPlaySettings|null);
            public adminAddedPermissions: (number|Long);
            public adminRemovedPermissions: (number|Long);
            public memberAddedPermissions: (number|Long);
            public memberRemovedPermissions: (number|Long);
            public guestAddedPermissions: (number|Long);
            public guestRemovedPermissions: (number|Long);
            public voiceChatEnabled: boolean;
            public p2pMediaEnabled: boolean;
            public static encode(message: synctv.client.IRoomSettings, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.RoomSettings;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IGetRoomSettingsResponse {
            settings?: (synctv.client.IRoomSettings|null);
            version?: (number|Long|null);
        }

        class GetRoomSettingsResponse implements IGetRoomSettingsResponse {
            constructor(properties?: synctv.client.IGetRoomSettingsResponse);
            public settings?: (synctv.client.IRoomSettings|null);
            public version: (number|Long);
            public static encode(message: synctv.client.IGetRoomSettingsResponse, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.GetRoomSettingsResponse;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum ResourceAvailability {
            RESOURCE_AVAILABILITY_UNSPECIFIED = 0,
            RESOURCE_AVAILABILITY_AVAILABLE = 1,
            RESOURCE_AVAILABILITY_CREATOR_INACTIVE = 2
        }

        interface IFileMetadata {
            width?: (number|null);
            height?: (number|null);
            durationSeconds?: (number|null);
            bitrateBps?: (number|null);
            blurhash?: (string|null);
        }

        class FileMetadata implements IFileMetadata {
            constructor(properties?: synctv.client.IFileMetadata);
            public width?: (number|null);
            public height?: (number|null);
            public durationSeconds?: (number|null);
            public bitrateBps?: (number|null);
            public blurhash?: (string|null);
            public _width?: "width";
            public _height?: "height";
            public _durationSeconds?: "durationSeconds";
            public _bitrateBps?: "bitrateBps";
            public _blurhash?: "blurhash";
            public static encode(message: synctv.client.IFileMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FileMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum FileObjectAccessKind {
            FILE_OBJECT_ACCESS_KIND_UNSPECIFIED = 0,
            FILE_OBJECT_ACCESS_KIND_CHAT_ATTACHMENT = 1,
            FILE_OBJECT_ACCESS_KIND_USER_AVATAR = 2,
            FILE_OBJECT_ACCESS_KIND_MEDIA_COVER = 3,
            FILE_OBJECT_ACCESS_KIND_ROOM_COVER = 4,
            FILE_OBJECT_ACCESS_KIND_PLAYLIST_COVER = 5,
            FILE_OBJECT_ACCESS_KIND_GENERIC = 6,
            FILE_OBJECT_ACCESS_KIND_MEDIA_THUMBNAIL = 7
        }

        interface IFileObjectAccess {
            objectKind?: (synctv.client.FileObjectAccessKind|null);
            encodedObjectKey?: (string|null);
            readToken?: (string|null);
        }

        class FileObjectAccess implements IFileObjectAccess {
            constructor(properties?: synctv.client.IFileObjectAccess);
            public objectKind: synctv.client.FileObjectAccessKind;
            public encodedObjectKey: string;
            public readToken: string;
            public static encode(message: synctv.client.IFileObjectAccess, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FileObjectAccess;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFileObjectVariant {
            key?: (string|null);
            label?: (string|null);
            url?: (string|null);
            mimeType?: (string|null);
            sizeBytes?: (number|Long|null);
            width?: (number|null);
            height?: (number|null);
            isOriginal?: (boolean|null);
            lossy?: (boolean|null);
            quality?: (number|null);
            metadata?: (synctv.client.IFileMetadata|null);
            objectAccess?: (synctv.client.IFileObjectAccess|null);
        }

        class FileObjectVariant implements IFileObjectVariant {
            constructor(properties?: synctv.client.IFileObjectVariant);
            public key: string;
            public label: string;
            public url: string;
            public mimeType: string;
            public sizeBytes: (number|Long);
            public width: number;
            public height: number;
            public isOriginal: boolean;
            public lossy: boolean;
            public quality?: (number|null);
            public metadata?: (synctv.client.IFileMetadata|null);
            public objectAccess?: (synctv.client.IFileObjectAccess|null);
            public _quality?: "quality";
            public static encode(message: synctv.client.IFileObjectVariant, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.FileObjectVariant;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IResourceCover {
            url?: (string|null);
            metadata?: (synctv.client.IFileMetadata|null);
            variants?: (synctv.client.IFileObjectVariant[]|null);
            objectAccess?: (synctv.client.IFileObjectAccess|null);
        }

        class ResourceCover implements IResourceCover {
            constructor(properties?: synctv.client.IResourceCover);
            public url: string;
            public metadata?: (synctv.client.IFileMetadata|null);
            public variants: synctv.client.IFileObjectVariant[];
            public objectAccess?: (synctv.client.IFileObjectAccess|null);
            public static encode(message: synctv.client.IResourceCover, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ResourceCover;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IResourceMetadata {
            source?: (string|null);
            provider?: (synctv.client.IPlaybackMetadata|null);
        }

        class ResourceMetadata implements IResourceMetadata {
            constructor(properties?: synctv.client.IResourceMetadata);
            public source?: (string|null);
            public provider?: (synctv.client.IPlaybackMetadata|null);
            public _source?: "source";
            public _provider?: "provider";
            public static encode(message: synctv.client.IResourceMetadata, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ResourceMetadata;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaylistBrowseAccessMode {
            PLAYLIST_BROWSE_ACCESS_MODE_DEFAULT = 0,
            PLAYLIST_BROWSE_ACCESS_MODE_ROOM_MEMBERS = 1,
            PLAYLIST_BROWSE_ACCESS_MODE_CREATOR_ONLY = 2
        }

        interface IPlaylist {
            id?: (string|null);
            roomId?: (string|null);
            name?: (string|null);
            parentId?: (string|null);
            position?: (number|null);
            isDynamic?: (boolean|null);
            itemCount?: (number|null);
            createdAt?: (number|Long|null);
            updatedAt?: (number|Long|null);
            availability?: (synctv.client.ResourceAvailability|null);
            version?: (number|Long|null);
            sourceConfig?: (synctv.source_config.IPlaylistSourceConfig|null);
            sourceProvider?: (synctv.source_config.SourceProvider|null);
            providerInstanceName?: (string|null);
            description?: (string|null);
            cover?: (synctv.client.IResourceCover|null);
            creatorId?: (string|null);
            metadata?: (synctv.client.IResourceMetadata|null);
            browseAccessMode?: (synctv.client.PlaylistBrowseAccessMode|null);
        }

        class Playlist implements IPlaylist {
            constructor(properties?: synctv.client.IPlaylist);
            public id: string;
            public roomId: string;
            public name: string;
            public parentId: string;
            public position: number;
            public isDynamic: boolean;
            public itemCount: number;
            public createdAt: (number|Long);
            public updatedAt: (number|Long);
            public availability: synctv.client.ResourceAvailability;
            public version: (number|Long);
            public sourceConfig?: (synctv.source_config.IPlaylistSourceConfig|null);
            public sourceProvider: synctv.source_config.SourceProvider;
            public providerInstanceName: string;
            public description: string;
            public cover?: (synctv.client.IResourceCover|null);
            public creatorId: string;
            public metadata?: (synctv.client.IResourceMetadata|null);
            public browseAccessMode: synctv.client.PlaylistBrowseAccessMode;
            public static encode(message: synctv.client.IPlaylist, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.Playlist;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IMediaCover {
            id?: (string|null);
            url?: (string|null);
            mimeType?: (string|null);
            sizeBytes?: (number|Long|null);
            width?: (number|null);
            height?: (number|null);
            metadata?: (synctv.client.IFileMetadata|null);
            variants?: (synctv.client.IFileObjectVariant[]|null);
            objectAccess?: (synctv.client.IFileObjectAccess|null);
        }

        class MediaCover implements IMediaCover {
            constructor(properties?: synctv.client.IMediaCover);
            public id: string;
            public url: string;
            public mimeType: string;
            public sizeBytes: (number|Long);
            public width: number;
            public height: number;
            public metadata?: (synctv.client.IFileMetadata|null);
            public variants: synctv.client.IFileObjectVariant[];
            public objectAccess?: (synctv.client.IFileObjectAccess|null);
            public static encode(message: synctv.client.IMediaCover, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.MediaCover;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IMediaThumbnail {
            id?: (string|null);
            url?: (string|null);
            mimeType?: (string|null);
            sizeBytes?: (number|Long|null);
            width?: (number|null);
            height?: (number|null);
            metadata?: (synctv.client.IFileMetadata|null);
            variants?: (synctv.client.IFileObjectVariant[]|null);
            objectAccess?: (synctv.client.IFileObjectAccess|null);
        }

        class MediaThumbnail implements IMediaThumbnail {
            constructor(properties?: synctv.client.IMediaThumbnail);
            public id: string;
            public url: string;
            public mimeType: string;
            public sizeBytes: (number|Long);
            public width: number;
            public height: number;
            public metadata?: (synctv.client.IFileMetadata|null);
            public variants: synctv.client.IFileObjectVariant[];
            public objectAccess?: (synctv.client.IFileObjectAccess|null);
            public static encode(message: synctv.client.IMediaThumbnail, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.MediaThumbnail;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IMedia {
            id?: (string|null);
            roomId?: (string|null);
            sourceProvider?: (synctv.source_config.SourceProvider|null);
            name?: (string|null);
            metadata?: (synctv.client.IResourceMetadata|null);
            position?: (number|null);
            addedAt?: (number|Long|null);
            creatorId?: (string|null);
            providerInstanceName?: (string|null);
            sourceConfig?: (synctv.source_config.IMediaSourceConfig|null);
            availability?: (synctv.client.ResourceAvailability|null);
            version?: (number|Long|null);
            cover?: (synctv.client.IMediaCover|null);
            description?: (string|null);
            thumbnail?: (synctv.client.IMediaThumbnail|null);
        }

        class Media implements IMedia {
            constructor(properties?: synctv.client.IMedia);
            public id: string;
            public roomId: string;
            public sourceProvider: synctv.source_config.SourceProvider;
            public name: string;
            public metadata?: (synctv.client.IResourceMetadata|null);
            public position: number;
            public addedAt: (number|Long);
            public creatorId: string;
            public providerInstanceName: string;
            public sourceConfig?: (synctv.source_config.IMediaSourceConfig|null);
            public availability: synctv.client.ResourceAvailability;
            public version: (number|Long);
            public cover?: (synctv.client.IMediaCover|null);
            public description: string;
            public thumbnail?: (synctv.client.IMediaThumbnail|null);
            public static encode(message: synctv.client.IMedia, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.Media;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum ItemType {
            ITEM_TYPE_UNSPECIFIED = 0,
            ITEM_TYPE_PLAYLIST = 1,
            ITEM_TYPE_MEDIA = 2
        }

        interface IPlaylistItem {
            name?: (string|null);
            itemType?: (synctv.client.ItemType|null);
            target?: (synctv.client.IProviderTarget|null);
            size?: (number|Long|null);
            thumbnail?: (string|null);
            modifiedAt?: (number|Long|null);
            description?: (string|null);
            mediaSourceConfig?: (synctv.source_config.IMediaSourceConfig|null);
            playlistSourceConfig?: (synctv.source_config.IPlaylistSourceConfig|null);
            metadata?: (synctv.client.IResourceMetadata|null);
        }

        class PlaylistItem implements IPlaylistItem {
            constructor(properties?: synctv.client.IPlaylistItem);
            public name: string;
            public itemType: synctv.client.ItemType;
            public target?: (synctv.client.IProviderTarget|null);
            public size?: (number|Long|null);
            public thumbnail?: (string|null);
            public modifiedAt?: (number|Long|null);
            public description: string;
            public mediaSourceConfig?: (synctv.source_config.IMediaSourceConfig|null);
            public playlistSourceConfig?: (synctv.source_config.IPlaylistSourceConfig|null);
            public metadata?: (synctv.client.IResourceMetadata|null);
            public _size?: "size";
            public _thumbnail?: "thumbnail";
            public _modifiedAt?: "modifiedAt";
            public sourceConfig?: ("mediaSourceConfig"|"playlistSourceConfig");
            public static encode(message: synctv.client.IPlaylistItem, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaylistItem;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaylistBrowsePathNode {
            playlistId?: (string|null);
            name?: (string|null);
            target?: (synctv.client.IProviderTarget|null);
        }

        class PlaylistBrowsePathNode implements IPlaylistBrowsePathNode {
            constructor(properties?: synctv.client.IPlaylistBrowsePathNode);
            public playlistId: string;
            public name: string;
            public target?: (synctv.client.IProviderTarget|null);
            public static encode(message: synctv.client.IPlaylistBrowsePathNode, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaylistBrowsePathNode;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IListPlaylistItemsResponse {
            playlists?: (synctv.client.IPlaylist[]|null);
            media?: (synctv.client.IMedia[]|null);
            total?: (number|Long|null);
            playlistCount?: (number|Long|null);
            fileCount?: (number|Long|null);
            dynamicItems?: (synctv.client.IPlaylistItem[]|null);
            currentPath?: (synctv.client.IPlaylistBrowsePathNode[]|null);
            version?: (string|null);
            page?: (synctv.client.IPagePagination|null);
            cursor?: (synctv.client.ICursorPagination|null);
            supportsSearch?: (boolean|null);
        }

        class ListPlaylistItemsResponse implements IListPlaylistItemsResponse {
            constructor(properties?: synctv.client.IListPlaylistItemsResponse);
            public playlists: synctv.client.IPlaylist[];
            public media: synctv.client.IMedia[];
            public total?: (number|Long|null);
            public playlistCount: (number|Long);
            public fileCount: (number|Long);
            public dynamicItems: synctv.client.IPlaylistItem[];
            public currentPath: synctv.client.IPlaylistBrowsePathNode[];
            public version: string;
            public page?: (synctv.client.IPagePagination|null);
            public cursor?: (synctv.client.ICursorPagination|null);
            public supportsSearch: boolean;
            public _total?: "total";
            public pagination?: ("page"|"cursor");
            public static encode(message: synctv.client.IListPlaylistItemsResponse, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ListPlaylistItemsResponse;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum RoomMemberEventKind {
            ROOM_MEMBER_EVENT_KIND_UNSPECIFIED = 0,
            ROOM_MEMBER_EVENT_KIND_JOINED = 1,
            ROOM_MEMBER_EVENT_KIND_LEFT = 2,
            ROOM_MEMBER_EVENT_KIND_PERMISSION_CHANGED = 3,
            ROOM_MEMBER_EVENT_KIND_KICKED = 4
        }

        interface IRoomMemberEvent {
            eventId?: (string|null);
            roomId?: (string|null);
            kind?: (synctv.client.RoomMemberEventKind|null);
            member?: (synctv.common.IRoomMember|null);
            userId?: (string|null);
            guestId?: (string|null);
            username?: (string|null);
            actorUserId?: (string|null);
            reason?: (string|null);
            occurredAt?: (number|Long|null);
            sequence?: (number|Long|null);
            remarkName?: (string|null);
            displayTag?: (string|null);
        }

        class RoomMemberEvent implements IRoomMemberEvent {
            constructor(properties?: synctv.client.IRoomMemberEvent);
            public eventId: string;
            public roomId: string;
            public kind: synctv.client.RoomMemberEventKind;
            public member?: (synctv.common.IRoomMember|null);
            public userId: string;
            public guestId: string;
            public username: string;
            public actorUserId: string;
            public reason: string;
            public occurredAt: (number|Long);
            public sequence: (number|Long);
            public remarkName: string;
            public displayTag: string;
            public static encode(message: synctv.client.IRoomMemberEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.RoomMemberEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum ChatMessageEventKind {
            CHAT_MESSAGE_EVENT_KIND_UNSPECIFIED = 0,
            CHAT_MESSAGE_EVENT_KIND_CREATED = 1,
            CHAT_MESSAGE_EVENT_KIND_EDITED = 2,
            CHAT_MESSAGE_EVENT_KIND_DELETED = 3,
            CHAT_MESSAGE_EVENT_KIND_REACTIONS_CHANGED = 4
        }

        enum ChatMessageStatus {
            CHAT_MESSAGE_STATUS_UNSPECIFIED = 0,
            CHAT_MESSAGE_STATUS_ACTIVE = 1,
            CHAT_MESSAGE_STATUS_EDITED = 2,
            CHAT_MESSAGE_STATUS_DELETED = 3
        }

        enum ChatAttachmentKind {
            CHAT_ATTACHMENT_KIND_UNSPECIFIED = 0,
            CHAT_ATTACHMENT_KIND_FILE = 1,
            CHAT_ATTACHMENT_KIND_IMAGE = 2,
            CHAT_ATTACHMENT_KIND_AUDIO = 3
        }

        interface IChatAttachment {
            id?: (string|null);
            url?: (string|null);
            mimeType?: (string|null);
            sizeBytes?: (number|Long|null);
            width?: (number|null);
            height?: (number|null);
            metadata?: (synctv.client.IFileMetadata|null);
            filename?: (string|null);
            kind?: (synctv.client.ChatAttachmentKind|null);
            reuseToken?: (string|null);
            reuseExpiresAt?: (number|Long|null);
            variants?: (synctv.client.IFileObjectVariant[]|null);
            objectAccess?: (synctv.client.IFileObjectAccess|null);
        }

        class ChatAttachment implements IChatAttachment {
            constructor(properties?: synctv.client.IChatAttachment);
            public id: string;
            public url: string;
            public mimeType: string;
            public sizeBytes: (number|Long);
            public width: number;
            public height: number;
            public metadata?: (synctv.client.IFileMetadata|null);
            public filename: string;
            public kind: synctv.client.ChatAttachmentKind;
            public reuseToken: string;
            public reuseExpiresAt?: (number|Long|null);
            public variants: synctv.client.IFileObjectVariant[];
            public objectAccess?: (synctv.client.IFileObjectAccess|null);
            public _reuseExpiresAt?: "reuseExpiresAt";
            public static encode(message: synctv.client.IChatAttachment, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatAttachment;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatReactionSummary {
            key?: (string|null);
            count?: (number|Long|null);
            reactedByMe?: (boolean|null);
        }

        class ChatReactionSummary implements IChatReactionSummary {
            constructor(properties?: synctv.client.IChatReactionSummary);
            public key: string;
            public count: (number|Long);
            public reactedByMe: boolean;
            public static encode(message: synctv.client.IChatReactionSummary, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatReactionSummary;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMention {
            userId?: (string|null);
            username?: (string|null);
            start?: (number|null);
            length?: (number|null);
        }

        class ChatMention implements IChatMention {
            constructor(properties?: synctv.client.IChatMention);
            public userId: string;
            public username: string;
            public start: number;
            public length: number;
            public static encode(message: synctv.client.IChatMention, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMention;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMessagePin {
            pinnedByUserId?: (string|null);
            pinnedByUsername?: (string|null);
            note?: (string|null);
            pinnedAt?: (number|Long|null);
        }

        class ChatMessagePin implements IChatMessagePin {
            constructor(properties?: synctv.client.IChatMessagePin);
            public pinnedByUserId: string;
            public pinnedByUsername: string;
            public note: string;
            public pinnedAt: (number|Long);
            public static encode(message: synctv.client.IChatMessagePin, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMessagePin;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMessageReceive {
            id?: (string|null);
            roomId?: (string|null);
            userId?: (string|null);
            username?: (string|null);
            content?: (string|null);
            timestamp?: (number|Long|null);
            displayPosition?: (string|null);
            displayColor?: (string|null);
            clientMessageId?: (string|null);
            status?: (synctv.client.ChatMessageStatus|null);
            version?: (number|Long|null);
            editedAt?: (number|Long|null);
            deletedAt?: (number|Long|null);
            replyToMessageId?: (string|null);
            attachments?: (synctv.client.IChatAttachment[]|null);
            deletedByUserId?: (string|null);
            deleteReason?: (string|null);
            playbackMediaId?: (string|null);
            playbackPlaylistId?: (string|null);
            playbackTarget?: (synctv.client.IProviderTarget|null);
            playbackTargetHash?: (string|null);
            playbackPositionSeconds?: (number|null);
            reactions?: (synctv.client.IChatReactionSummary[]|null);
            reactionCount?: (number|null);
            metadata?: (synctv.client.IChatMetadata|null);
            mentions?: (synctv.client.IChatMention[]|null);
            pin?: (synctv.client.IChatMessagePin|null);
            messageType?: (synctv.client.ChatMessageType|null);
        }

        class ChatMessageReceive implements IChatMessageReceive {
            constructor(properties?: synctv.client.IChatMessageReceive);
            public id: string;
            public roomId: string;
            public userId: string;
            public username?: (string|null);
            public content: string;
            public timestamp: (number|Long);
            public displayPosition: string;
            public displayColor: string;
            public clientMessageId: string;
            public status: synctv.client.ChatMessageStatus;
            public version: (number|Long);
            public editedAt: (number|Long);
            public deletedAt: (number|Long);
            public replyToMessageId: string;
            public attachments: synctv.client.IChatAttachment[];
            public deletedByUserId: string;
            public deleteReason: string;
            public playbackMediaId: string;
            public playbackPlaylistId: string;
            public playbackTarget?: (synctv.client.IProviderTarget|null);
            public playbackTargetHash: string;
            public playbackPositionSeconds?: (number|null);
            public reactions: synctv.client.IChatReactionSummary[];
            public reactionCount: number;
            public metadata?: (synctv.client.IChatMetadata|null);
            public mentions: synctv.client.IChatMention[];
            public pin?: (synctv.client.IChatMessagePin|null);
            public messageType: synctv.client.ChatMessageType;
            public _username?: "username";
            public _playbackPositionSeconds?: "playbackPositionSeconds";
            public _pin?: "pin";
            public static encode(message: synctv.client.IChatMessageReceive, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMessageReceive;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IChatMessageEvent {
            eventId?: (string|null);
            roomId?: (string|null);
            kind?: (synctv.client.ChatMessageEventKind|null);
            message?: (synctv.client.IChatMessageReceive|null);
            occurredAt?: (number|Long|null);
            sequence?: (number|Long|null);
        }

        class ChatMessageEvent implements IChatMessageEvent {
            constructor(properties?: synctv.client.IChatMessageEvent);
            public eventId: string;
            public roomId: string;
            public kind: synctv.client.ChatMessageEventKind;
            public message?: (synctv.client.IChatMessageReceive|null);
            public occurredAt: (number|Long);
            public sequence: (number|Long);
            public static encode(message: synctv.client.IChatMessageEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatMessageEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IOnlineCount {
            onlineMemberCount?: (number|null);
            onlineGuestCount?: (number|null);
        }

        class OnlineCount implements IOnlineCount {
            constructor(properties?: synctv.client.IOnlineCount);
            public onlineMemberCount: number;
            public onlineGuestCount: number;
            public static encode(message: synctv.client.IOnlineCount, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.OnlineCount;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IOnlineEvent {
            eventId?: (string|null);
            roomId?: (string|null);
            userId?: (string|null);
            username?: (string|null);
            role?: (synctv.common.RoomMemberRole|null);
            kind?: (synctv.client.OnlineEventKind|null);
            occurredAt?: (number|Long|null);
        }

        class OnlineEvent implements IOnlineEvent {
            constructor(properties?: synctv.client.IOnlineEvent);
            public eventId: string;
            public roomId: string;
            public userId: string;
            public username: string;
            public role: synctv.common.RoomMemberRole;
            public kind: synctv.client.OnlineEventKind;
            public occurredAt: (number|Long);
            public static encode(message: synctv.client.IOnlineEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.OnlineEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceOffer {
            from?: (string|null);
            data?: (string|null);
        }

        class WebRTCVoiceOffer implements IWebRTCVoiceOffer {
            constructor(properties?: synctv.client.IWebRTCVoiceOffer);
            public from: string;
            public data: string;
            public static encode(message: synctv.client.IWebRTCVoiceOffer, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceOffer;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceAnswer {
            from?: (string|null);
            data?: (string|null);
        }

        class WebRTCVoiceAnswer implements IWebRTCVoiceAnswer {
            constructor(properties?: synctv.client.IWebRTCVoiceAnswer);
            public from: string;
            public data: string;
            public static encode(message: synctv.client.IWebRTCVoiceAnswer, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceAnswer;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoiceIceCandidate {
            from?: (string|null);
            data?: (string|null);
        }

        class WebRTCVoiceIceCandidate implements IWebRTCVoiceIceCandidate {
            constructor(properties?: synctv.client.IWebRTCVoiceIceCandidate);
            public from: string;
            public data: string;
            public static encode(message: synctv.client.IWebRTCVoiceIceCandidate, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoiceIceCandidate;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoicePeerJoined {
            userId?: (string|null);
            connId?: (string|null);
            username?: (string|null);
        }

        class WebRTCVoicePeerJoined implements IWebRTCVoicePeerJoined {
            constructor(properties?: synctv.client.IWebRTCVoicePeerJoined);
            public userId: string;
            public connId: string;
            public username: string;
            public static encode(message: synctv.client.IWebRTCVoicePeerJoined, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoicePeerJoined;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCVoicePeerLeft {
            userId?: (string|null);
            connId?: (string|null);
        }

        class WebRTCVoicePeerLeft implements IWebRTCVoicePeerLeft {
            constructor(properties?: synctv.client.IWebRTCVoicePeerLeft);
            public userId: string;
            public connId: string;
            public static encode(message: synctv.client.IWebRTCVoicePeerLeft, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCVoicePeerLeft;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaOffer {
            from?: (string|null);
            data?: (string|null);
            swarmId?: (string|null);
        }

        class WebRTCMediaOffer implements IWebRTCMediaOffer {
            constructor(properties?: synctv.client.IWebRTCMediaOffer);
            public from: string;
            public data: string;
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaOffer, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaOffer;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaAnswer {
            from?: (string|null);
            data?: (string|null);
            swarmId?: (string|null);
        }

        class WebRTCMediaAnswer implements IWebRTCMediaAnswer {
            constructor(properties?: synctv.client.IWebRTCMediaAnswer);
            public from: string;
            public data: string;
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaAnswer, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaAnswer;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaIceCandidate {
            from?: (string|null);
            data?: (string|null);
            swarmId?: (string|null);
        }

        class WebRTCMediaIceCandidate implements IWebRTCMediaIceCandidate {
            constructor(properties?: synctv.client.IWebRTCMediaIceCandidate);
            public from: string;
            public data: string;
            public swarmId: string;
            public static encode(message: synctv.client.IWebRTCMediaIceCandidate, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaIceCandidate;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaSwarmPeer {
            userId?: (string|null);
            connId?: (string|null);
        }

        class WebRTCMediaSwarmPeer implements IWebRTCMediaSwarmPeer {
            constructor(properties?: synctv.client.IWebRTCMediaSwarmPeer);
            public userId: string;
            public connId: string;
            public static encode(message: synctv.client.IWebRTCMediaSwarmPeer, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaSwarmPeer;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaSwarmPeers {
            swarmId?: (string|null);
            peers?: (synctv.client.IWebRTCMediaSwarmPeer[]|null);
            swarmTicket?: (string|null);
        }

        class WebRTCMediaSwarmPeers implements IWebRTCMediaSwarmPeers {
            constructor(properties?: synctv.client.IWebRTCMediaSwarmPeers);
            public swarmId: string;
            public peers: synctv.client.IWebRTCMediaSwarmPeer[];
            public swarmTicket: string;
            public static encode(message: synctv.client.IWebRTCMediaSwarmPeers, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaSwarmPeers;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCMediaPeerLeft {
            swarmId?: (string|null);
            userId?: (string|null);
            connId?: (string|null);
        }

        class WebRTCMediaPeerLeft implements IWebRTCMediaPeerLeft {
            constructor(properties?: synctv.client.IWebRTCMediaPeerLeft);
            public swarmId: string;
            public userId: string;
            public connId: string;
            public static encode(message: synctv.client.IWebRTCMediaPeerLeft, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCMediaPeerLeft;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWebRTCEvent {
            voiceOffer?: (synctv.client.IWebRTCVoiceOffer|null);
            voiceAnswer?: (synctv.client.IWebRTCVoiceAnswer|null);
            voiceIceCandidate?: (synctv.client.IWebRTCVoiceIceCandidate|null);
            voicePeerJoined?: (synctv.client.IWebRTCVoicePeerJoined|null);
            voicePeerLeft?: (synctv.client.IWebRTCVoicePeerLeft|null);
            mediaOffer?: (synctv.client.IWebRTCMediaOffer|null);
            mediaAnswer?: (synctv.client.IWebRTCMediaAnswer|null);
            mediaIceCandidate?: (synctv.client.IWebRTCMediaIceCandidate|null);
            mediaSwarmPeers?: (synctv.client.IWebRTCMediaSwarmPeers|null);
            mediaPeerLeft?: (synctv.client.IWebRTCMediaPeerLeft|null);
        }

        class WebRTCEvent implements IWebRTCEvent {
            constructor(properties?: synctv.client.IWebRTCEvent);
            public voiceOffer?: (synctv.client.IWebRTCVoiceOffer|null);
            public voiceAnswer?: (synctv.client.IWebRTCVoiceAnswer|null);
            public voiceIceCandidate?: (synctv.client.IWebRTCVoiceIceCandidate|null);
            public voicePeerJoined?: (synctv.client.IWebRTCVoicePeerJoined|null);
            public voicePeerLeft?: (synctv.client.IWebRTCVoicePeerLeft|null);
            public mediaOffer?: (synctv.client.IWebRTCMediaOffer|null);
            public mediaAnswer?: (synctv.client.IWebRTCMediaAnswer|null);
            public mediaIceCandidate?: (synctv.client.IWebRTCMediaIceCandidate|null);
            public mediaSwarmPeers?: (synctv.client.IWebRTCMediaSwarmPeers|null);
            public mediaPeerLeft?: (synctv.client.IWebRTCMediaPeerLeft|null);
            public event?: ("voiceOffer"|"voiceAnswer"|"voiceIceCandidate"|"voicePeerJoined"|"voicePeerLeft"|"mediaOffer"|"mediaAnswer"|"mediaIceCandidate"|"mediaSwarmPeers"|"mediaPeerLeft");
            public static encode(message: synctv.client.IWebRTCEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.WebRTCEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum ChatPinEventKind {
            CHAT_PIN_EVENT_KIND_UNSPECIFIED = 0,
            CHAT_PIN_EVENT_KIND_PINNED = 1,
            CHAT_PIN_EVENT_KIND_UNPINNED = 2,
            CHAT_PIN_EVENT_KIND_MESSAGE_UPDATED = 3,
            CHAT_PIN_EVENT_KIND_MESSAGE_DELETED = 4
        }

        interface IChatPinEvent {
            eventId?: (string|null);
            roomId?: (string|null);
            kind?: (synctv.client.ChatPinEventKind|null);
            message?: (synctv.client.IChatMessageReceive|null);
            pin?: (synctv.client.IChatMessagePin|null);
            occurredAt?: (number|Long|null);
            sequence?: (number|Long|null);
        }

        class ChatPinEvent implements IChatPinEvent {
            constructor(properties?: synctv.client.IChatPinEvent);
            public eventId: string;
            public roomId: string;
            public kind: synctv.client.ChatPinEventKind;
            public message?: (synctv.client.IChatMessageReceive|null);
            public pin?: (synctv.client.IChatMessagePin|null);
            public occurredAt: (number|Long);
            public sequence: (number|Long);
            public static encode(message: synctv.client.IChatPinEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ChatPinEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaybackHistoryEntry {
            id?: (string|null);
            mediaId?: (string|null);
            playlistId?: (string|null);
            target?: (synctv.client.IProviderTarget|null);
            positionSeconds?: (number|null);
            selectedByUserId?: (string|null);
            createdAt?: (number|Long|null);
            updatedAt?: (number|Long|null);
            mediaName?: (string|null);
            playlistName?: (string|null);
            sourceProvider?: (synctv.source_config.SourceProvider|null);
            providerInstanceName?: (string|null);
        }

        class PlaybackHistoryEntry implements IPlaybackHistoryEntry {
            constructor(properties?: synctv.client.IPlaybackHistoryEntry);
            public id: string;
            public mediaId: string;
            public playlistId: string;
            public target?: (synctv.client.IProviderTarget|null);
            public positionSeconds: number;
            public selectedByUserId: string;
            public createdAt: (number|Long);
            public updatedAt: (number|Long);
            public mediaName: string;
            public playlistName: string;
            public sourceProvider: synctv.source_config.SourceProvider;
            public providerInstanceName: string;
            public static encode(message: synctv.client.IPlaybackHistoryEntry, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.PlaybackHistoryEntry;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IListPlaybackHistoryResponse {
            entries?: (synctv.client.IPlaybackHistoryEntry[]|null);
            historyCursorId?: (string|null);
            nextCursorEntryId?: (string|null);
        }

        class ListPlaybackHistoryResponse implements IListPlaybackHistoryResponse {
            constructor(properties?: synctv.client.IListPlaybackHistoryResponse);
            public entries: synctv.client.IPlaybackHistoryEntry[];
            public historyCursorId: string;
            public nextCursorEntryId: string;
            public static encode(message: synctv.client.IListPlaybackHistoryResponse, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ListPlaybackHistoryResponse;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IResourceEvent {
            observeId?: (string|null);
            changedOnly?: (synctv.client.IResourceEventOnly|null);
            playbackState?: (synctv.client.IPlaybackState|null);
            playback?: (synctv.client.IPlayback|null);
            roomSettings?: (synctv.client.IGetRoomSettingsResponse|null);
            playlistItems?: (synctv.client.IListPlaylistItemsResponse|null);
            roomMemberEvent?: (synctv.client.IRoomMemberEvent|null);
            chatEvent?: (synctv.client.IChatMessageEvent|null);
            onlineCount?: (synctv.client.IOnlineCount|null);
            onlineEvent?: (synctv.client.IOnlineEvent|null);
            webrtcEvent?: (synctv.client.IWebRTCEvent|null);
            selfRoomMember?: (synctv.common.IRoomMember|null);
            chatPinEvent?: (synctv.client.IChatPinEvent|null);
            playbackHistory?: (synctv.client.IListPlaybackHistoryResponse|null);
            eventCursor?: (synctv.client.IEventCursor|null);
        }

        class ResourceEvent implements IResourceEvent {
            constructor(properties?: synctv.client.IResourceEvent);
            public observeId: string;
            public changedOnly?: (synctv.client.IResourceEventOnly|null);
            public playbackState?: (synctv.client.IPlaybackState|null);
            public playback?: (synctv.client.IPlayback|null);
            public roomSettings?: (synctv.client.IGetRoomSettingsResponse|null);
            public playlistItems?: (synctv.client.IListPlaylistItemsResponse|null);
            public roomMemberEvent?: (synctv.client.IRoomMemberEvent|null);
            public chatEvent?: (synctv.client.IChatMessageEvent|null);
            public onlineCount?: (synctv.client.IOnlineCount|null);
            public onlineEvent?: (synctv.client.IOnlineEvent|null);
            public webrtcEvent?: (synctv.client.IWebRTCEvent|null);
            public selfRoomMember?: (synctv.common.IRoomMember|null);
            public chatPinEvent?: (synctv.client.IChatPinEvent|null);
            public playbackHistory?: (synctv.client.IListPlaybackHistoryResponse|null);
            public eventCursor?: (synctv.client.IEventCursor|null);
            public payload?: ("changedOnly"|"playbackState"|"playback"|"roomSettings"|"playlistItems"|"roomMemberEvent"|"chatEvent"|"onlineCount"|"onlineEvent"|"webrtcEvent"|"selfRoomMember"|"chatPinEvent"|"playbackHistory");
            public static encode(message: synctv.client.IResourceEvent, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ResourceEvent;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IResourceObserveError {
            observeId?: (string|null);
            error?: (synctv.client.IErrorMessage|null);
        }

        class ResourceObserveError implements IResourceObserveError {
            constructor(properties?: synctv.client.IResourceObserveError);
            public observeId: string;
            public error?: (synctv.client.IErrorMessage|null);
            public static encode(message: synctv.client.IResourceObserveError, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ResourceObserveError;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum RealtimeTerminationCode {
            REALTIME_TERMINATION_CODE_UNSPECIFIED = 0,
            REALTIME_TERMINATION_CODE_CONNECTION_REVOKED = 1,
            REALTIME_TERMINATION_CODE_USER_ACCESS_REVOKED = 2,
            REALTIME_TERMINATION_CODE_ROOM_ACCESS_REVOKED = 3,
            REALTIME_TERMINATION_CODE_ROOM_MEMBERSHIP_REVOKED = 4,
            REALTIME_TERMINATION_CODE_GUEST_ACCESS_REVOKED = 5,
            REALTIME_TERMINATION_CODE_ROOM_DELETED = 6,
            REALTIME_TERMINATION_CODE_ROOM_BANNED = 7,
            REALTIME_TERMINATION_CODE_ROOM_OWNER_INACTIVE = 8
        }

        interface IRealtimeTermination {
            message?: (string|null);
            code?: (synctv.client.RealtimeTerminationCode|null);
        }

        class RealtimeTermination implements IRealtimeTermination {
            constructor(properties?: synctv.client.IRealtimeTermination);
            public message: string;
            public code: synctv.client.RealtimeTerminationCode;
            public static encode(message: synctv.client.IRealtimeTermination, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.RealtimeTermination;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IServerMessage {
            heartbeatAck?: (synctv.client.IHeartbeatAck|null);
            error?: (synctv.client.IErrorMessage|null);
            notification?: (synctv.client.IUserNotification|null);
            resourceObserved?: (synctv.client.IResourceObserved|null);
            resourceEvent?: (synctv.client.IResourceEvent|null);
            resourceObserveError?: (synctv.client.IResourceObserveError|null);
            termination?: (synctv.client.IRealtimeTermination|null);
        }

        class ServerMessage implements IServerMessage {
            constructor(properties?: synctv.client.IServerMessage);
            public heartbeatAck?: (synctv.client.IHeartbeatAck|null);
            public error?: (synctv.client.IErrorMessage|null);
            public notification?: (synctv.client.IUserNotification|null);
            public resourceObserved?: (synctv.client.IResourceObserved|null);
            public resourceEvent?: (synctv.client.IResourceEvent|null);
            public resourceObserveError?: (synctv.client.IResourceObserveError|null);
            public termination?: (synctv.client.IRealtimeTermination|null);
            public message?: ("heartbeatAck"|"error"|"notification"|"resourceObserved"|"resourceEvent"|"resourceObserveError"|"termination");
            public static encode(message: synctv.client.IServerMessage, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.client.ServerMessage;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    namespace source_config {

        enum SynologyLibraryItemKind {
            SYNOLOGY_LIBRARY_ITEM_KIND_UNSPECIFIED = 0,
            SYNOLOGY_LIBRARY_ITEM_KIND_MOVIE = 1,
            SYNOLOGY_LIBRARY_ITEM_KIND_EPISODE = 2,
            SYNOLOGY_LIBRARY_ITEM_KIND_HOME_VIDEO = 3,
            SYNOLOGY_LIBRARY_ITEM_KIND_TV_RECORDING = 4
        }

        enum SourceProvider {
            SOURCE_PROVIDER_UNSPECIFIED = 0,
            SOURCE_PROVIDER_DIRECT_URL = 1,
            SOURCE_PROVIDER_BILIBILI = 2,
            SOURCE_PROVIDER_ALIST = 3,
            SOURCE_PROVIDER_EMBY = 4,
            SOURCE_PROVIDER_RTMP = 5,
            SOURCE_PROVIDER_LIVE_PROXY = 6,
            SOURCE_PROVIDER_CLOUDREVE = 7,
            SOURCE_PROVIDER_TWITCH = 8,
            SOURCE_PROVIDER_HUYA = 9,
            SOURCE_PROVIDER_DOUYU = 10,
            SOURCE_PROVIDER_DOUYIN = 11,
            SOURCE_PROVIDER_ACFUN = 12,
            SOURCE_PROVIDER_CCTV = 13,
            SOURCE_PROVIDER_FNOS = 14,
            SOURCE_PROVIDER_QNAP = 15,
            SOURCE_PROVIDER_SYNOLOGY = 16,
            SOURCE_PROVIDER_NEXTCLOUD = 17,
            SOURCE_PROVIDER_SEAFILE = 18,
            SOURCE_PROVIDER_TRUENAS = 19,
            SOURCE_PROVIDER_YOUTUBE = 20,
            SOURCE_PROVIDER_TIKTOK = 21
        }

        interface IBilibiliVideoPartsPlaylistSource {
            bvid?: (string|null);
            aid?: (number|Long|null);
        }

        class BilibiliVideoPartsPlaylistSource implements IBilibiliVideoPartsPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliVideoPartsPlaylistSource);
            public bvid: string;
            public aid?: (number|Long|null);
            public _aid?: "aid";
            public static encode(message: synctv.source_config.IBilibiliVideoPartsPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliVideoPartsPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliPopularPlaylistSource {
        }

        class BilibiliPopularPlaylistSource implements IBilibiliPopularPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliPopularPlaylistSource);
            public static encode(message: synctv.source_config.IBilibiliPopularPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliPopularPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliRecommendedPlaylistSource {
        }

        class BilibiliRecommendedPlaylistSource implements IBilibiliRecommendedPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliRecommendedPlaylistSource);
            public static encode(message: synctv.source_config.IBilibiliRecommendedPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliRecommendedPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliUpVideosPlaylistSource {
            mid?: (number|Long|null);
            keyword?: (string|null);
        }

        class BilibiliUpVideosPlaylistSource implements IBilibiliUpVideosPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliUpVideosPlaylistSource);
            public mid: (number|Long);
            public keyword: string;
            public static encode(message: synctv.source_config.IBilibiliUpVideosPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliUpVideosPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliFavoriteVideosPlaylistSource {
            mediaId?: (number|Long|null);
        }

        class BilibiliFavoriteVideosPlaylistSource implements IBilibiliFavoriteVideosPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliFavoriteVideosPlaylistSource);
            public mediaId: (number|Long);
            public static encode(message: synctv.source_config.IBilibiliFavoriteVideosPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliFavoriteVideosPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliCollectionVideosPlaylistSource {
            mid?: (number|Long|null);
            seasonId?: (number|Long|null);
        }

        class BilibiliCollectionVideosPlaylistSource implements IBilibiliCollectionVideosPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliCollectionVideosPlaylistSource);
            public mid: (number|Long);
            public seasonId: (number|Long);
            public static encode(message: synctv.source_config.IBilibiliCollectionVideosPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliCollectionVideosPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliSeriesVideosPlaylistSource {
            mid?: (number|Long|null);
            seriesId?: (number|Long|null);
        }

        class BilibiliSeriesVideosPlaylistSource implements IBilibiliSeriesVideosPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliSeriesVideosPlaylistSource);
            public mid: (number|Long);
            public seriesId: (number|Long);
            public static encode(message: synctv.source_config.IBilibiliSeriesVideosPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliSeriesVideosPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliWatchLaterPlaylistSource {
        }

        class BilibiliWatchLaterPlaylistSource implements IBilibiliWatchLaterPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliWatchLaterPlaylistSource);
            public static encode(message: synctv.source_config.IBilibiliWatchLaterPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliWatchLaterPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliPgcSeasonPlaylistSource {
            seasonId?: (number|Long|null);
        }

        class BilibiliPgcSeasonPlaylistSource implements IBilibiliPgcSeasonPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliPgcSeasonPlaylistSource);
            public seasonId: (number|Long);
            public static encode(message: synctv.source_config.IBilibiliPgcSeasonPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliPgcSeasonPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliLiveRecommendedPlaylistSource {
        }

        class BilibiliLiveRecommendedPlaylistSource implements IBilibiliLiveRecommendedPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliLiveRecommendedPlaylistSource);
            public static encode(message: synctv.source_config.IBilibiliLiveRecommendedPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliLiveRecommendedPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliLiveFollowedPlaylistSource {
        }

        class BilibiliLiveFollowedPlaylistSource implements IBilibiliLiveFollowedPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliLiveFollowedPlaylistSource);
            public static encode(message: synctv.source_config.IBilibiliLiveFollowedPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliLiveFollowedPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliLiveAreaPlaylistSource {
            parentAreaId?: (number|Long|null);
            areaId?: (number|Long|null);
        }

        class BilibiliLiveAreaPlaylistSource implements IBilibiliLiveAreaPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliLiveAreaPlaylistSource);
            public parentAreaId: (number|Long);
            public areaId: (number|Long);
            public static encode(message: synctv.source_config.IBilibiliLiveAreaPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliLiveAreaPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum BilibiliHistoryType {
            BILIBILI_HISTORY_TYPE_ALL = 0,
            BILIBILI_HISTORY_TYPE_ARCHIVE = 1,
            BILIBILI_HISTORY_TYPE_LIVE = 2
        }

        interface IBilibiliHistoryPlaylistSource {
            type?: (synctv.source_config.BilibiliHistoryType|null);
        }

        class BilibiliHistoryPlaylistSource implements IBilibiliHistoryPlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliHistoryPlaylistSource);
            public type: synctv.source_config.BilibiliHistoryType;
            public static encode(message: synctv.source_config.IBilibiliHistoryPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliHistoryPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum BilibiliPgcTimelineType {
            BILIBILI_PGC_TIMELINE_TYPE_UNSPECIFIED = 0,
            BILIBILI_PGC_TIMELINE_TYPE_ANIME = 1,
            BILIBILI_PGC_TIMELINE_TYPE_CINEMA = 3,
            BILIBILI_PGC_TIMELINE_TYPE_GUOCHUANG = 4
        }

        interface IBilibiliPgcTimelinePlaylistSource {
            type?: (synctv.source_config.BilibiliPgcTimelineType|null);
            beforeDays?: (number|null);
            afterDays?: (number|null);
        }

        class BilibiliPgcTimelinePlaylistSource implements IBilibiliPgcTimelinePlaylistSource {
            constructor(properties?: synctv.source_config.IBilibiliPgcTimelinePlaylistSource);
            public type: synctv.source_config.BilibiliPgcTimelineType;
            public beforeDays: number;
            public afterDays: number;
            public static encode(message: synctv.source_config.IBilibiliPgcTimelinePlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliPgcTimelinePlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaybackProxyMode {
            PLAYBACK_PROXY_MODE_AUTO = 0,
            PLAYBACK_PROXY_MODE_PREFER = 1,
            PLAYBACK_PROXY_MODE_ONLY = 2,
            PLAYBACK_PROXY_MODE_DIRECT_PREFER = 3,
            PLAYBACK_PROXY_MODE_DIRECT_ONLY = 4
        }

        interface IBilibiliPlaylistSourceConfig {
            videoParts?: (synctv.source_config.IBilibiliVideoPartsPlaylistSource|null);
            popular?: (synctv.source_config.IBilibiliPopularPlaylistSource|null);
            recommended?: (synctv.source_config.IBilibiliRecommendedPlaylistSource|null);
            upVideos?: (synctv.source_config.IBilibiliUpVideosPlaylistSource|null);
            favoriteVideos?: (synctv.source_config.IBilibiliFavoriteVideosPlaylistSource|null);
            collectionVideos?: (synctv.source_config.IBilibiliCollectionVideosPlaylistSource|null);
            seriesVideos?: (synctv.source_config.IBilibiliSeriesVideosPlaylistSource|null);
            watchLater?: (synctv.source_config.IBilibiliWatchLaterPlaylistSource|null);
            pgcSeason?: (synctv.source_config.IBilibiliPgcSeasonPlaylistSource|null);
            liveRecommended?: (synctv.source_config.IBilibiliLiveRecommendedPlaylistSource|null);
            liveFollowed?: (synctv.source_config.IBilibiliLiveFollowedPlaylistSource|null);
            liveArea?: (synctv.source_config.IBilibiliLiveAreaPlaylistSource|null);
            history?: (synctv.source_config.IBilibiliHistoryPlaylistSource|null);
            pgcTimeline?: (synctv.source_config.IBilibiliPgcTimelinePlaylistSource|null);
            shared?: (boolean|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class BilibiliPlaylistSourceConfig implements IBilibiliPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IBilibiliPlaylistSourceConfig);
            public videoParts?: (synctv.source_config.IBilibiliVideoPartsPlaylistSource|null);
            public popular?: (synctv.source_config.IBilibiliPopularPlaylistSource|null);
            public recommended?: (synctv.source_config.IBilibiliRecommendedPlaylistSource|null);
            public upVideos?: (synctv.source_config.IBilibiliUpVideosPlaylistSource|null);
            public favoriteVideos?: (synctv.source_config.IBilibiliFavoriteVideosPlaylistSource|null);
            public collectionVideos?: (synctv.source_config.IBilibiliCollectionVideosPlaylistSource|null);
            public seriesVideos?: (synctv.source_config.IBilibiliSeriesVideosPlaylistSource|null);
            public watchLater?: (synctv.source_config.IBilibiliWatchLaterPlaylistSource|null);
            public pgcSeason?: (synctv.source_config.IBilibiliPgcSeasonPlaylistSource|null);
            public liveRecommended?: (synctv.source_config.IBilibiliLiveRecommendedPlaylistSource|null);
            public liveFollowed?: (synctv.source_config.IBilibiliLiveFollowedPlaylistSource|null);
            public liveArea?: (synctv.source_config.IBilibiliLiveAreaPlaylistSource|null);
            public history?: (synctv.source_config.IBilibiliHistoryPlaylistSource|null);
            public pgcTimeline?: (synctv.source_config.IBilibiliPgcTimelinePlaylistSource|null);
            public shared: boolean;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("videoParts"|"popular"|"recommended"|"upVideos"|"favoriteVideos"|"collectionVideos"|"seriesVideos"|"watchLater"|"pgcSeason"|"liveRecommended"|"liveFollowed"|"liveArea"|"history"|"pgcTimeline");
            public static encode(message: synctv.source_config.IBilibiliPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAlistPlaylistSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            password?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class AlistPlaylistSourceConfig implements IAlistPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IAlistPlaylistSourceConfig);
            public serverId: string;
            public path: string;
            public password?: (string|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public _password?: "password";
            public static encode(message: synctv.source_config.IAlistPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.AlistPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyFolderPlaylistSource {
            itemId?: (string|null);
        }

        class EmbyFolderPlaylistSource implements IEmbyFolderPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyFolderPlaylistSource);
            public itemId: string;
            public static encode(message: synctv.source_config.IEmbyFolderPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyFolderPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyFavoriteItemsPlaylistSource {
            itemTypes?: (string[]|null);
        }

        class EmbyFavoriteItemsPlaylistSource implements IEmbyFavoriteItemsPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyFavoriteItemsPlaylistSource);
            public itemTypes: string[];
            public static encode(message: synctv.source_config.IEmbyFavoriteItemsPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyFavoriteItemsPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyFavoritePeoplePlaylistSource {
        }

        class EmbyFavoritePeoplePlaylistSource implements IEmbyFavoritePeoplePlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyFavoritePeoplePlaylistSource);
            public static encode(message: synctv.source_config.IEmbyFavoritePeoplePlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyFavoritePeoplePlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyPersonItemsPlaylistSource {
            personId?: (string|null);
            itemTypes?: (string[]|null);
        }

        class EmbyPersonItemsPlaylistSource implements IEmbyPersonItemsPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyPersonItemsPlaylistSource);
            public personId: string;
            public itemTypes: string[];
            public static encode(message: synctv.source_config.IEmbyPersonItemsPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyPersonItemsPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyContinueWatchingPlaylistSource {
        }

        class EmbyContinueWatchingPlaylistSource implements IEmbyContinueWatchingPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyContinueWatchingPlaylistSource);
            public static encode(message: synctv.source_config.IEmbyContinueWatchingPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyContinueWatchingPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyNextUpPlaylistSource {
        }

        class EmbyNextUpPlaylistSource implements IEmbyNextUpPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyNextUpPlaylistSource);
            public static encode(message: synctv.source_config.IEmbyNextUpPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyNextUpPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyRecentlyAddedPlaylistSource {
            itemTypes?: (string[]|null);
        }

        class EmbyRecentlyAddedPlaylistSource implements IEmbyRecentlyAddedPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyRecentlyAddedPlaylistSource);
            public itemTypes: string[];
            public static encode(message: synctv.source_config.IEmbyRecentlyAddedPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyRecentlyAddedPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyPlaylistsPlaylistSource {
        }

        class EmbyPlaylistsPlaylistSource implements IEmbyPlaylistsPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyPlaylistsPlaylistSource);
            public static encode(message: synctv.source_config.IEmbyPlaylistsPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyPlaylistsPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyCollectionsPlaylistSource {
        }

        class EmbyCollectionsPlaylistSource implements IEmbyCollectionsPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyCollectionsPlaylistSource);
            public static encode(message: synctv.source_config.IEmbyCollectionsPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyCollectionsPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyGenresPlaylistSource {
            itemTypes?: (string[]|null);
        }

        class EmbyGenresPlaylistSource implements IEmbyGenresPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyGenresPlaylistSource);
            public itemTypes: string[];
            public static encode(message: synctv.source_config.IEmbyGenresPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyGenresPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyGenreItemsPlaylistSource {
            genreId?: (string|null);
            itemTypes?: (string[]|null);
        }

        class EmbyGenreItemsPlaylistSource implements IEmbyGenreItemsPlaylistSource {
            constructor(properties?: synctv.source_config.IEmbyGenreItemsPlaylistSource);
            public genreId: string;
            public itemTypes: string[];
            public static encode(message: synctv.source_config.IEmbyGenreItemsPlaylistSource, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyGenreItemsPlaylistSource;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyPlaylistSourceConfig {
            serverId?: (string|null);
            folder?: (synctv.source_config.IEmbyFolderPlaylistSource|null);
            favoriteItems?: (synctv.source_config.IEmbyFavoriteItemsPlaylistSource|null);
            favoritePeople?: (synctv.source_config.IEmbyFavoritePeoplePlaylistSource|null);
            personItems?: (synctv.source_config.IEmbyPersonItemsPlaylistSource|null);
            continueWatching?: (synctv.source_config.IEmbyContinueWatchingPlaylistSource|null);
            nextUp?: (synctv.source_config.IEmbyNextUpPlaylistSource|null);
            recentlyAdded?: (synctv.source_config.IEmbyRecentlyAddedPlaylistSource|null);
            playlists?: (synctv.source_config.IEmbyPlaylistsPlaylistSource|null);
            collections?: (synctv.source_config.IEmbyCollectionsPlaylistSource|null);
            genres?: (synctv.source_config.IEmbyGenresPlaylistSource|null);
            genreItems?: (synctv.source_config.IEmbyGenreItemsPlaylistSource|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class EmbyPlaylistSourceConfig implements IEmbyPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IEmbyPlaylistSourceConfig);
            public serverId: string;
            public folder?: (synctv.source_config.IEmbyFolderPlaylistSource|null);
            public favoriteItems?: (synctv.source_config.IEmbyFavoriteItemsPlaylistSource|null);
            public favoritePeople?: (synctv.source_config.IEmbyFavoritePeoplePlaylistSource|null);
            public personItems?: (synctv.source_config.IEmbyPersonItemsPlaylistSource|null);
            public continueWatching?: (synctv.source_config.IEmbyContinueWatchingPlaylistSource|null);
            public nextUp?: (synctv.source_config.IEmbyNextUpPlaylistSource|null);
            public recentlyAdded?: (synctv.source_config.IEmbyRecentlyAddedPlaylistSource|null);
            public playlists?: (synctv.source_config.IEmbyPlaylistsPlaylistSource|null);
            public collections?: (synctv.source_config.IEmbyCollectionsPlaylistSource|null);
            public genres?: (synctv.source_config.IEmbyGenresPlaylistSource|null);
            public genreItems?: (synctv.source_config.IEmbyGenreItemsPlaylistSource|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("folder"|"favoriteItems"|"favoritePeople"|"personItems"|"continueWatching"|"nextUp"|"recentlyAdded"|"playlists"|"collections"|"genres"|"genreItems");
            public static encode(message: synctv.source_config.IEmbyPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICloudrevePlaylistSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class CloudrevePlaylistSourceConfig implements ICloudrevePlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ICloudrevePlaylistSourceConfig);
            public serverId: string;
            public path: string;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.ICloudrevePlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.CloudrevePlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum TwitchPlaylistContent {
            TWITCH_PLAYLIST_CONTENT_UNSPECIFIED = 0,
            TWITCH_PLAYLIST_CONTENT_VIDEOS = 1,
            TWITCH_PLAYLIST_CONTENT_HIGHLIGHTS = 2,
            TWITCH_PLAYLIST_CONTENT_UPLOADS = 3,
            TWITCH_PLAYLIST_CONTENT_CLIPS = 4
        }

        interface ITwitchPlaylistSourceConfig {
            shared?: (boolean|null);
            channel?: (synctv.source_config.TwitchPlaylistSourceConfig.IChannel|null);
            followedLive?: (synctv.source_config.TwitchPlaylistSourceConfig.IFollowedLive|null);
            categoryLive?: (synctv.source_config.TwitchPlaylistSourceConfig.ICategoryLive|null);
            searchLive?: (synctv.source_config.TwitchPlaylistSourceConfig.ISearchLive|null);
        }

        class TwitchPlaylistSourceConfig implements ITwitchPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ITwitchPlaylistSourceConfig);
            public shared: boolean;
            public channel?: (synctv.source_config.TwitchPlaylistSourceConfig.IChannel|null);
            public followedLive?: (synctv.source_config.TwitchPlaylistSourceConfig.IFollowedLive|null);
            public categoryLive?: (synctv.source_config.TwitchPlaylistSourceConfig.ICategoryLive|null);
            public searchLive?: (synctv.source_config.TwitchPlaylistSourceConfig.ISearchLive|null);
            public source?: ("channel"|"followedLive"|"categoryLive"|"searchLive");
            public static encode(message: synctv.source_config.ITwitchPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace TwitchPlaylistSourceConfig {

            interface IChannel {
                channel?: (string|null);
                content?: (synctv.source_config.TwitchPlaylistContent|null);
            }

            class Channel implements IChannel {
                constructor(properties?: synctv.source_config.TwitchPlaylistSourceConfig.IChannel);
                public channel: string;
                public content: synctv.source_config.TwitchPlaylistContent;
                public static encode(message: synctv.source_config.TwitchPlaylistSourceConfig.IChannel, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchPlaylistSourceConfig.Channel;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface IFollowedLive {
            }

            class FollowedLive implements IFollowedLive {
                constructor(properties?: synctv.source_config.TwitchPlaylistSourceConfig.IFollowedLive);
                public static encode(message: synctv.source_config.TwitchPlaylistSourceConfig.IFollowedLive, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchPlaylistSourceConfig.FollowedLive;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface ICategoryLive {
                categoryId?: (string|null);
                categoryName?: (string|null);
            }

            class CategoryLive implements ICategoryLive {
                constructor(properties?: synctv.source_config.TwitchPlaylistSourceConfig.ICategoryLive);
                public categoryId: string;
                public categoryName: string;
                public static encode(message: synctv.source_config.TwitchPlaylistSourceConfig.ICategoryLive, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchPlaylistSourceConfig.CategoryLive;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface ISearchLive {
                query?: (string|null);
            }

            class SearchLive implements ISearchLive {
                constructor(properties?: synctv.source_config.TwitchPlaylistSourceConfig.ISearchLive);
                public query: string;
                public static encode(message: synctv.source_config.TwitchPlaylistSourceConfig.ISearchLive, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchPlaylistSourceConfig.SearchLive;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        interface IDouyinPlaylistSourceConfig {
            secUid?: (string|null);
            shared?: (boolean|null);
        }

        class DouyinPlaylistSourceConfig implements IDouyinPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IDouyinPlaylistSourceConfig);
            public secUid: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.IDouyinPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DouyinPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosFilesPlaylistSourceConfig {
            path?: (string|null);
        }

        class FnosFilesPlaylistSourceConfig implements IFnosFilesPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IFnosFilesPlaylistSourceConfig);
            public path: string;
            public static encode(message: synctv.source_config.IFnosFilesPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosFilesPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosMediaLibraryPlaylistSourceConfig {
            libraryGuid?: (string|null);
            mediaTypes?: (string[]|null);
            parentGuid?: (string|null);
        }

        class FnosMediaLibraryPlaylistSourceConfig implements IFnosMediaLibraryPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IFnosMediaLibraryPlaylistSourceConfig);
            public libraryGuid: string;
            public mediaTypes: string[];
            public parentGuid?: (string|null);
            public _parentGuid?: "parentGuid";
            public static encode(message: synctv.source_config.IFnosMediaLibraryPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosMediaLibraryPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosFavoritesPlaylistSourceConfig {
            mediaTypes?: (string[]|null);
        }

        class FnosFavoritesPlaylistSourceConfig implements IFnosFavoritesPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IFnosFavoritesPlaylistSourceConfig);
            public mediaTypes: string[];
            public static encode(message: synctv.source_config.IFnosFavoritesPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosFavoritesPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosHistoryPlaylistSourceConfig {
        }

        class FnosHistoryPlaylistSourceConfig implements IFnosHistoryPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IFnosHistoryPlaylistSourceConfig);
            public static encode(message: synctv.source_config.IFnosHistoryPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosHistoryPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosPlaylistSourceConfig {
            serverId?: (string|null);
            files?: (synctv.source_config.IFnosFilesPlaylistSourceConfig|null);
            mediaLibrary?: (synctv.source_config.IFnosMediaLibraryPlaylistSourceConfig|null);
            favorites?: (synctv.source_config.IFnosFavoritesPlaylistSourceConfig|null);
            history?: (synctv.source_config.IFnosHistoryPlaylistSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class FnosPlaylistSourceConfig implements IFnosPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IFnosPlaylistSourceConfig);
            public serverId: string;
            public files?: (synctv.source_config.IFnosFilesPlaylistSourceConfig|null);
            public mediaLibrary?: (synctv.source_config.IFnosMediaLibraryPlaylistSourceConfig|null);
            public favorites?: (synctv.source_config.IFnosFavoritesPlaylistSourceConfig|null);
            public history?: (synctv.source_config.IFnosHistoryPlaylistSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("files"|"mediaLibrary"|"favorites"|"history");
            public static encode(message: synctv.source_config.IFnosPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IQnapPlaylistSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class QnapPlaylistSourceConfig implements IQnapPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IQnapPlaylistSourceConfig);
            public serverId: string;
            public path: string;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.IQnapPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.QnapPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyFilesPlaylistSourceConfig {
            path?: (string|null);
        }

        class SynologyFilesPlaylistSourceConfig implements ISynologyFilesPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyFilesPlaylistSourceConfig);
            public path: string;
            public static encode(message: synctv.source_config.ISynologyFilesPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyFilesPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyMoviesPlaylistSourceConfig {
            libraryId?: (number|Long|null);
        }

        class SynologyMoviesPlaylistSourceConfig implements ISynologyMoviesPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyMoviesPlaylistSourceConfig);
            public libraryId: (number|Long);
            public static encode(message: synctv.source_config.ISynologyMoviesPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyMoviesPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyTvShowsPlaylistSourceConfig {
            libraryId?: (number|Long|null);
        }

        class SynologyTvShowsPlaylistSourceConfig implements ISynologyTvShowsPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyTvShowsPlaylistSourceConfig);
            public libraryId: (number|Long);
            public static encode(message: synctv.source_config.ISynologyTvShowsPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyTvShowsPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyEpisodesPlaylistSourceConfig {
            libraryId?: (number|Long|null);
            tvShowId?: (number|Long|null);
        }

        class SynologyEpisodesPlaylistSourceConfig implements ISynologyEpisodesPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyEpisodesPlaylistSourceConfig);
            public libraryId: (number|Long);
            public tvShowId: (number|Long);
            public static encode(message: synctv.source_config.ISynologyEpisodesPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyEpisodesPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyHomeVideosPlaylistSourceConfig {
            libraryId?: (number|Long|null);
        }

        class SynologyHomeVideosPlaylistSourceConfig implements ISynologyHomeVideosPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyHomeVideosPlaylistSourceConfig);
            public libraryId: (number|Long);
            public static encode(message: synctv.source_config.ISynologyHomeVideosPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyHomeVideosPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyTvRecordingsPlaylistSourceConfig {
            libraryId?: (number|Long|null);
        }

        class SynologyTvRecordingsPlaylistSourceConfig implements ISynologyTvRecordingsPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyTvRecordingsPlaylistSourceConfig);
            public libraryId: (number|Long);
            public static encode(message: synctv.source_config.ISynologyTvRecordingsPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyTvRecordingsPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyPlaylistSourceConfig {
            serverId?: (string|null);
            files?: (synctv.source_config.ISynologyFilesPlaylistSourceConfig|null);
            movies?: (synctv.source_config.ISynologyMoviesPlaylistSourceConfig|null);
            tvShows?: (synctv.source_config.ISynologyTvShowsPlaylistSourceConfig|null);
            episodes?: (synctv.source_config.ISynologyEpisodesPlaylistSourceConfig|null);
            homeVideos?: (synctv.source_config.ISynologyHomeVideosPlaylistSourceConfig|null);
            tvRecordings?: (synctv.source_config.ISynologyTvRecordingsPlaylistSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class SynologyPlaylistSourceConfig implements ISynologyPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyPlaylistSourceConfig);
            public serverId: string;
            public files?: (synctv.source_config.ISynologyFilesPlaylistSourceConfig|null);
            public movies?: (synctv.source_config.ISynologyMoviesPlaylistSourceConfig|null);
            public tvShows?: (synctv.source_config.ISynologyTvShowsPlaylistSourceConfig|null);
            public episodes?: (synctv.source_config.ISynologyEpisodesPlaylistSourceConfig|null);
            public homeVideos?: (synctv.source_config.ISynologyHomeVideosPlaylistSourceConfig|null);
            public tvRecordings?: (synctv.source_config.ISynologyTvRecordingsPlaylistSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("files"|"movies"|"tvShows"|"episodes"|"homeVideos"|"tvRecordings");
            public static encode(message: synctv.source_config.ISynologyPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudFolderPlaylistSourceConfig {
            path?: (string|null);
        }

        class NextcloudFolderPlaylistSourceConfig implements INextcloudFolderPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.INextcloudFolderPlaylistSourceConfig);
            public path: string;
            public static encode(message: synctv.source_config.INextcloudFolderPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.NextcloudFolderPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudFavoritesPlaylistSourceConfig {
        }

        class NextcloudFavoritesPlaylistSourceConfig implements INextcloudFavoritesPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.INextcloudFavoritesPlaylistSourceConfig);
            public static encode(message: synctv.source_config.INextcloudFavoritesPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.NextcloudFavoritesPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudSearchPlaylistSourceConfig {
            path?: (string|null);
            query?: (string|null);
        }

        class NextcloudSearchPlaylistSourceConfig implements INextcloudSearchPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.INextcloudSearchPlaylistSourceConfig);
            public path: string;
            public query: string;
            public static encode(message: synctv.source_config.INextcloudSearchPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.NextcloudSearchPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudPlaylistSourceConfig {
            serverId?: (string|null);
            folder?: (synctv.source_config.INextcloudFolderPlaylistSourceConfig|null);
            favorites?: (synctv.source_config.INextcloudFavoritesPlaylistSourceConfig|null);
            search?: (synctv.source_config.INextcloudSearchPlaylistSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class NextcloudPlaylistSourceConfig implements INextcloudPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.INextcloudPlaylistSourceConfig);
            public serverId: string;
            public folder?: (synctv.source_config.INextcloudFolderPlaylistSourceConfig|null);
            public favorites?: (synctv.source_config.INextcloudFavoritesPlaylistSourceConfig|null);
            public search?: (synctv.source_config.INextcloudSearchPlaylistSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("folder"|"favorites"|"search");
            public static encode(message: synctv.source_config.INextcloudPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.NextcloudPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafileFolderPlaylistSourceConfig {
            repositoryId?: (string|null);
            path?: (string|null);
        }

        class SeafileFolderPlaylistSourceConfig implements ISeafileFolderPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISeafileFolderPlaylistSourceConfig);
            public repositoryId: string;
            public path: string;
            public static encode(message: synctv.source_config.ISeafileFolderPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SeafileFolderPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafileStarredPlaylistSourceConfig {
        }

        class SeafileStarredPlaylistSourceConfig implements ISeafileStarredPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISeafileStarredPlaylistSourceConfig);
            public static encode(message: synctv.source_config.ISeafileStarredPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SeafileStarredPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafileSearchPlaylistSourceConfig {
            repositoryId?: (string|null);
            query?: (string|null);
        }

        class SeafileSearchPlaylistSourceConfig implements ISeafileSearchPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISeafileSearchPlaylistSourceConfig);
            public repositoryId: string;
            public query: string;
            public static encode(message: synctv.source_config.ISeafileSearchPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SeafileSearchPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafilePlaylistSourceConfig {
            serverId?: (string|null);
            folder?: (synctv.source_config.ISeafileFolderPlaylistSourceConfig|null);
            starred?: (synctv.source_config.ISeafileStarredPlaylistSourceConfig|null);
            search?: (synctv.source_config.ISeafileSearchPlaylistSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class SeafilePlaylistSourceConfig implements ISeafilePlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ISeafilePlaylistSourceConfig);
            public serverId: string;
            public folder?: (synctv.source_config.ISeafileFolderPlaylistSourceConfig|null);
            public starred?: (synctv.source_config.ISeafileStarredPlaylistSourceConfig|null);
            public search?: (synctv.source_config.ISeafileSearchPlaylistSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("folder"|"starred"|"search");
            public static encode(message: synctv.source_config.ISeafilePlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SeafilePlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITrueNasFolderPlaylistSourceConfig {
            path?: (string|null);
        }

        class TrueNasFolderPlaylistSourceConfig implements ITrueNasFolderPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ITrueNasFolderPlaylistSourceConfig);
            public path: string;
            public static encode(message: synctv.source_config.ITrueNasFolderPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TrueNasFolderPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITrueNasSearchPlaylistSourceConfig {
            path?: (string|null);
            query?: (string|null);
        }

        class TrueNasSearchPlaylistSourceConfig implements ITrueNasSearchPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ITrueNasSearchPlaylistSourceConfig);
            public path: string;
            public query: string;
            public static encode(message: synctv.source_config.ITrueNasSearchPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TrueNasSearchPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITrueNasPlaylistSourceConfig {
            serverId?: (string|null);
            folder?: (synctv.source_config.ITrueNasFolderPlaylistSourceConfig|null);
            search?: (synctv.source_config.ITrueNasSearchPlaylistSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class TrueNasPlaylistSourceConfig implements ITrueNasPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ITrueNasPlaylistSourceConfig);
            public serverId: string;
            public folder?: (synctv.source_config.ITrueNasFolderPlaylistSourceConfig|null);
            public search?: (synctv.source_config.ITrueNasSearchPlaylistSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("folder"|"search");
            public static encode(message: synctv.source_config.ITrueNasPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TrueNasPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IYoutubePlaylistSourceConfig {
            shared?: (boolean|null);
            playlist?: (synctv.source_config.YoutubePlaylistSourceConfig.IPlaylist|null);
            channel?: (synctv.source_config.YoutubePlaylistSourceConfig.IChannel|null);
            search?: (synctv.source_config.YoutubePlaylistSourceConfig.ISearch|null);
            subscriptions?: (synctv.source_config.YoutubePlaylistSourceConfig.ISubscriptions|null);
            likedVideos?: (synctv.source_config.YoutubePlaylistSourceConfig.ILikedVideos|null);
            watchLater?: (synctv.source_config.YoutubePlaylistSourceConfig.IWatchLater|null);
        }

        class YoutubePlaylistSourceConfig implements IYoutubePlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IYoutubePlaylistSourceConfig);
            public shared: boolean;
            public playlist?: (synctv.source_config.YoutubePlaylistSourceConfig.IPlaylist|null);
            public channel?: (synctv.source_config.YoutubePlaylistSourceConfig.IChannel|null);
            public search?: (synctv.source_config.YoutubePlaylistSourceConfig.ISearch|null);
            public subscriptions?: (synctv.source_config.YoutubePlaylistSourceConfig.ISubscriptions|null);
            public likedVideos?: (synctv.source_config.YoutubePlaylistSourceConfig.ILikedVideos|null);
            public watchLater?: (synctv.source_config.YoutubePlaylistSourceConfig.IWatchLater|null);
            public source?: ("playlist"|"channel"|"search"|"subscriptions"|"likedVideos"|"watchLater");
            public static encode(message: synctv.source_config.IYoutubePlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        namespace YoutubePlaylistSourceConfig {

            interface IPlaylist {
                playlistId?: (string|null);
            }

            class Playlist implements IPlaylist {
                constructor(properties?: synctv.source_config.YoutubePlaylistSourceConfig.IPlaylist);
                public playlistId: string;
                public static encode(message: synctv.source_config.YoutubePlaylistSourceConfig.IPlaylist, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig.Playlist;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface IChannel {
                channelId?: (string|null);
                content?: (synctv.source_config.YoutubeChannelContent|null);
            }

            class Channel implements IChannel {
                constructor(properties?: synctv.source_config.YoutubePlaylistSourceConfig.IChannel);
                public channelId: string;
                public content: synctv.source_config.YoutubeChannelContent;
                public static encode(message: synctv.source_config.YoutubePlaylistSourceConfig.IChannel, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig.Channel;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface ISearch {
                query?: (string|null);
            }

            class Search implements ISearch {
                constructor(properties?: synctv.source_config.YoutubePlaylistSourceConfig.ISearch);
                public query: string;
                public static encode(message: synctv.source_config.YoutubePlaylistSourceConfig.ISearch, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig.Search;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface ISubscriptions {
            }

            class Subscriptions implements ISubscriptions {
                constructor(properties?: synctv.source_config.YoutubePlaylistSourceConfig.ISubscriptions);
                public static encode(message: synctv.source_config.YoutubePlaylistSourceConfig.ISubscriptions, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig.Subscriptions;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface ILikedVideos {
            }

            class LikedVideos implements ILikedVideos {
                constructor(properties?: synctv.source_config.YoutubePlaylistSourceConfig.ILikedVideos);
                public static encode(message: synctv.source_config.YoutubePlaylistSourceConfig.ILikedVideos, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig.LikedVideos;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            interface IWatchLater {
            }

            class WatchLater implements IWatchLater {
                constructor(properties?: synctv.source_config.YoutubePlaylistSourceConfig.IWatchLater);
                public static encode(message: synctv.source_config.YoutubePlaylistSourceConfig.IWatchLater, writer?: $protobuf.Writer): $protobuf.Writer;
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubePlaylistSourceConfig.WatchLater;
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }

        enum YoutubeChannelContent {
            YOUTUBE_CHANNEL_CONTENT_UNSPECIFIED = 0,
            YOUTUBE_CHANNEL_CONTENT_VIDEOS = 1,
            YOUTUBE_CHANNEL_CONTENT_SHORTS = 2,
            YOUTUBE_CHANNEL_CONTENT_LIVE = 3
        }

        interface ITikTokPlaylistSourceConfig {
            secUid?: (string|null);
            shared?: (boolean|null);
        }

        class TikTokPlaylistSourceConfig implements ITikTokPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.ITikTokPlaylistSourceConfig);
            public secUid: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.ITikTokPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TikTokPlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IPlaylistSourceConfig {
            bilibili?: (synctv.source_config.IBilibiliPlaylistSourceConfig|null);
            alist?: (synctv.source_config.IAlistPlaylistSourceConfig|null);
            emby?: (synctv.source_config.IEmbyPlaylistSourceConfig|null);
            cloudreve?: (synctv.source_config.ICloudrevePlaylistSourceConfig|null);
            twitch?: (synctv.source_config.ITwitchPlaylistSourceConfig|null);
            douyin?: (synctv.source_config.IDouyinPlaylistSourceConfig|null);
            fnos?: (synctv.source_config.IFnosPlaylistSourceConfig|null);
            qnap?: (synctv.source_config.IQnapPlaylistSourceConfig|null);
            synology?: (synctv.source_config.ISynologyPlaylistSourceConfig|null);
            nextcloud?: (synctv.source_config.INextcloudPlaylistSourceConfig|null);
            seafile?: (synctv.source_config.ISeafilePlaylistSourceConfig|null);
            truenas?: (synctv.source_config.ITrueNasPlaylistSourceConfig|null);
            youtube?: (synctv.source_config.IYoutubePlaylistSourceConfig|null);
            tiktok?: (synctv.source_config.ITikTokPlaylistSourceConfig|null);
        }

        class PlaylistSourceConfig implements IPlaylistSourceConfig {
            constructor(properties?: synctv.source_config.IPlaylistSourceConfig);
            public bilibili?: (synctv.source_config.IBilibiliPlaylistSourceConfig|null);
            public alist?: (synctv.source_config.IAlistPlaylistSourceConfig|null);
            public emby?: (synctv.source_config.IEmbyPlaylistSourceConfig|null);
            public cloudreve?: (synctv.source_config.ICloudrevePlaylistSourceConfig|null);
            public twitch?: (synctv.source_config.ITwitchPlaylistSourceConfig|null);
            public douyin?: (synctv.source_config.IDouyinPlaylistSourceConfig|null);
            public fnos?: (synctv.source_config.IFnosPlaylistSourceConfig|null);
            public qnap?: (synctv.source_config.IQnapPlaylistSourceConfig|null);
            public synology?: (synctv.source_config.ISynologyPlaylistSourceConfig|null);
            public nextcloud?: (synctv.source_config.INextcloudPlaylistSourceConfig|null);
            public seafile?: (synctv.source_config.ISeafilePlaylistSourceConfig|null);
            public truenas?: (synctv.source_config.ITrueNasPlaylistSourceConfig|null);
            public youtube?: (synctv.source_config.IYoutubePlaylistSourceConfig|null);
            public tiktok?: (synctv.source_config.ITikTokPlaylistSourceConfig|null);
            public provider?: ("bilibili"|"alist"|"emby"|"cloudreve"|"twitch"|"douyin"|"fnos"|"qnap"|"synology"|"nextcloud"|"seafile"|"truenas"|"youtube"|"tiktok");
            public static encode(message: synctv.source_config.IPlaylistSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.PlaylistSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum PlaybackKind {
            PLAYBACK_KIND_UNSPECIFIED = 0,
            PLAYBACK_KIND_REGULAR = 1,
            PLAYBACK_KIND_LIVE = 2
        }

        interface IDirectUrlMediaResourceConfig {
            name?: (string|null);
            url?: (string|null);
            headers?: ({ [k: string]: string }|null);
            format?: (string|null);
            expiresAt?: (number|Long|null);
        }

        class DirectUrlMediaResourceConfig implements IDirectUrlMediaResourceConfig {
            constructor(properties?: synctv.source_config.IDirectUrlMediaResourceConfig);
            public name: string;
            public url: string;
            public headers: { [k: string]: string };
            public format: string;
            public expiresAt?: (number|Long|null);
            public _expiresAt?: "expiresAt";
            public static encode(message: synctv.source_config.IDirectUrlMediaResourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DirectUrlMediaResourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDirectUrlSubtitleSourceConfig {
            name?: (string|null);
            language?: (string|null);
            url?: (string|null);
            headers?: ({ [k: string]: string }|null);
            format?: (string|null);
            expiresAt?: (number|Long|null);
        }

        class DirectUrlSubtitleSourceConfig implements IDirectUrlSubtitleSourceConfig {
            constructor(properties?: synctv.source_config.IDirectUrlSubtitleSourceConfig);
            public name: string;
            public language: string;
            public url: string;
            public headers: { [k: string]: string };
            public format: string;
            public expiresAt?: (number|Long|null);
            public _expiresAt?: "expiresAt";
            public static encode(message: synctv.source_config.IDirectUrlSubtitleSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DirectUrlSubtitleSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDirectUrlDanmakuSourceConfig {
            name?: (string|null);
            url?: (string|null);
            headers?: ({ [k: string]: string }|null);
            format?: (string|null);
            expiresAt?: (number|Long|null);
        }

        class DirectUrlDanmakuSourceConfig implements IDirectUrlDanmakuSourceConfig {
            constructor(properties?: synctv.source_config.IDirectUrlDanmakuSourceConfig);
            public name: string;
            public url: string;
            public headers: { [k: string]: string };
            public format?: (string|null);
            public expiresAt?: (number|Long|null);
            public _format?: "format";
            public _expiresAt?: "expiresAt";
            public static encode(message: synctv.source_config.IDirectUrlDanmakuSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DirectUrlDanmakuSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDirectUrlMediaSourceConfig {
            medias?: (synctv.source_config.IDirectUrlMediaResourceConfig[]|null);
            defaultMediaIndex?: (number|null);
            subtitles?: (synctv.source_config.IDirectUrlSubtitleSourceConfig[]|null);
            defaultSubtitleIndex?: (number|null);
            danmakus?: (synctv.source_config.IDirectUrlDanmakuSourceConfig[]|null);
            defaultDanmakuIndex?: (number|null);
            playbackKind?: (synctv.source_config.PlaybackKind|null);
            durationSeconds?: (number|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class DirectUrlMediaSourceConfig implements IDirectUrlMediaSourceConfig {
            constructor(properties?: synctv.source_config.IDirectUrlMediaSourceConfig);
            public medias: synctv.source_config.IDirectUrlMediaResourceConfig[];
            public defaultMediaIndex?: (number|null);
            public subtitles: synctv.source_config.IDirectUrlSubtitleSourceConfig[];
            public defaultSubtitleIndex?: (number|null);
            public danmakus: synctv.source_config.IDirectUrlDanmakuSourceConfig[];
            public defaultDanmakuIndex?: (number|null);
            public playbackKind?: (synctv.source_config.PlaybackKind|null);
            public durationSeconds?: (number|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public _defaultMediaIndex?: "defaultMediaIndex";
            public _defaultSubtitleIndex?: "defaultSubtitleIndex";
            public _defaultDanmakuIndex?: "defaultDanmakuIndex";
            public _playbackKind?: "playbackKind";
            public _durationSeconds?: "durationSeconds";
            public static encode(message: synctv.source_config.IDirectUrlMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DirectUrlMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliVideoSourceConfig {
            bvid?: (string|null);
            aid?: (number|Long|null);
            cid?: (number|Long|null);
            shared?: (boolean|null);
        }

        class BilibiliVideoSourceConfig implements IBilibiliVideoSourceConfig {
            constructor(properties?: synctv.source_config.IBilibiliVideoSourceConfig);
            public bvid: string;
            public aid?: (number|Long|null);
            public cid: (number|Long);
            public shared: boolean;
            public _aid?: "aid";
            public static encode(message: synctv.source_config.IBilibiliVideoSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliVideoSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliPgcSourceConfig {
            epid?: (number|Long|null);
            cid?: (number|Long|null);
            shared?: (boolean|null);
        }

        class BilibiliPgcSourceConfig implements IBilibiliPgcSourceConfig {
            constructor(properties?: synctv.source_config.IBilibiliPgcSourceConfig);
            public epid: (number|Long);
            public cid: (number|Long);
            public shared: boolean;
            public static encode(message: synctv.source_config.IBilibiliPgcSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliPgcSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliLiveSourceConfig {
            roomId?: (number|Long|null);
            shared?: (boolean|null);
        }

        class BilibiliLiveSourceConfig implements IBilibiliLiveSourceConfig {
            constructor(properties?: synctv.source_config.IBilibiliLiveSourceConfig);
            public roomId: (number|Long);
            public shared: boolean;
            public static encode(message: synctv.source_config.IBilibiliLiveSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliLiveSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IBilibiliMediaSourceConfig {
            video?: (synctv.source_config.IBilibiliVideoSourceConfig|null);
            pgc?: (synctv.source_config.IBilibiliPgcSourceConfig|null);
            live?: (synctv.source_config.IBilibiliLiveSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class BilibiliMediaSourceConfig implements IBilibiliMediaSourceConfig {
            constructor(properties?: synctv.source_config.IBilibiliMediaSourceConfig);
            public video?: (synctv.source_config.IBilibiliVideoSourceConfig|null);
            public pgc?: (synctv.source_config.IBilibiliPgcSourceConfig|null);
            public live?: (synctv.source_config.IBilibiliLiveSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("video"|"pgc"|"live");
            public static encode(message: synctv.source_config.IBilibiliMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.BilibiliMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAlistMediaSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            password?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class AlistMediaSourceConfig implements IAlistMediaSourceConfig {
            constructor(properties?: synctv.source_config.IAlistMediaSourceConfig);
            public serverId: string;
            public path: string;
            public password?: (string|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public _password?: "password";
            public static encode(message: synctv.source_config.IAlistMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.AlistMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IEmbyMediaSourceConfig {
            serverId?: (string|null);
            itemId?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class EmbyMediaSourceConfig implements IEmbyMediaSourceConfig {
            constructor(properties?: synctv.source_config.IEmbyMediaSourceConfig);
            public serverId: string;
            public itemId: string;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.IEmbyMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.EmbyMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum RtmpStreamMode {
            RTMP_STREAM_MODE_UNSPECIFIED = 0,
            RTMP_STREAM_MODE_DEFAULT = 1,
            RTMP_STREAM_MODE_VIDEO_ONLY = 2,
            RTMP_STREAM_MODE_AUDIO_ONLY = 3
        }

        interface IRtmpMediaSourceConfig {
            mode?: (synctv.source_config.RtmpStreamMode|null);
        }

        class RtmpMediaSourceConfig implements IRtmpMediaSourceConfig {
            constructor(properties?: synctv.source_config.IRtmpMediaSourceConfig);
            public mode: synctv.source_config.RtmpStreamMode;
            public static encode(message: synctv.source_config.IRtmpMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.RtmpMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IRtmpPullSourceConfig {
            url?: (string|null);
            mode?: (synctv.source_config.RtmpStreamMode|null);
        }

        class RtmpPullSourceConfig implements IRtmpPullSourceConfig {
            constructor(properties?: synctv.source_config.IRtmpPullSourceConfig);
            public url: string;
            public mode: synctv.source_config.RtmpStreamMode;
            public static encode(message: synctv.source_config.IRtmpPullSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.RtmpPullSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        enum RtspTransport {
            RTSP_TRANSPORT_UNSPECIFIED = 0,
            RTSP_TRANSPORT_TCP = 1,
            RTSP_TRANSPORT_UDP = 2
        }

        interface IRtspTrackSelection {
            firstCompatible?: (boolean|null);
            index?: (number|null);
            disabled?: (boolean|null);
        }

        class RtspTrackSelection implements IRtspTrackSelection {
            constructor(properties?: synctv.source_config.IRtspTrackSelection);
            public firstCompatible?: (boolean|null);
            public index?: (number|null);
            public disabled?: (boolean|null);
            public mode?: ("firstCompatible"|"index"|"disabled");
            public static encode(message: synctv.source_config.IRtspTrackSelection, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.RtspTrackSelection;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IRtspPullSourceConfig {
            url?: (string|null);
            transport?: (synctv.source_config.RtspTransport|null);
            videoTrack?: (synctv.source_config.IRtspTrackSelection|null);
            audioTrack?: (synctv.source_config.IRtspTrackSelection|null);
        }

        class RtspPullSourceConfig implements IRtspPullSourceConfig {
            constructor(properties?: synctv.source_config.IRtspPullSourceConfig);
            public url: string;
            public transport: synctv.source_config.RtspTransport;
            public videoTrack?: (synctv.source_config.IRtspTrackSelection|null);
            public audioTrack?: (synctv.source_config.IRtspTrackSelection|null);
            public static encode(message: synctv.source_config.IRtspPullSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.RtspPullSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHttpFlvPullSourceConfig {
            url?: (string|null);
        }

        class HttpFlvPullSourceConfig implements IHttpFlvPullSourceConfig {
            constructor(properties?: synctv.source_config.IHttpFlvPullSourceConfig);
            public url: string;
            public static encode(message: synctv.source_config.IHttpFlvPullSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.HttpFlvPullSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IWhepPullSourceConfig {
            url?: (string|null);
            authorization?: (string|null);
        }

        class WhepPullSourceConfig implements IWhepPullSourceConfig {
            constructor(properties?: synctv.source_config.IWhepPullSourceConfig);
            public url: string;
            public authorization?: (string|null);
            public _authorization?: "authorization";
            public static encode(message: synctv.source_config.IWhepPullSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.WhepPullSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ILiveProxyMediaSourceConfig {
            rtmp?: (synctv.source_config.IRtmpPullSourceConfig|null);
            rtsp?: (synctv.source_config.IRtspPullSourceConfig|null);
            httpFlv?: (synctv.source_config.IHttpFlvPullSourceConfig|null);
            whep?: (synctv.source_config.IWhepPullSourceConfig|null);
        }

        class LiveProxyMediaSourceConfig implements ILiveProxyMediaSourceConfig {
            constructor(properties?: synctv.source_config.ILiveProxyMediaSourceConfig);
            public rtmp?: (synctv.source_config.IRtmpPullSourceConfig|null);
            public rtsp?: (synctv.source_config.IRtspPullSourceConfig|null);
            public httpFlv?: (synctv.source_config.IHttpFlvPullSourceConfig|null);
            public whep?: (synctv.source_config.IWhepPullSourceConfig|null);
            public source?: ("rtmp"|"rtsp"|"httpFlv"|"whep");
            public static encode(message: synctv.source_config.ILiveProxyMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.LiveProxyMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICloudreveMediaSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class CloudreveMediaSourceConfig implements ICloudreveMediaSourceConfig {
            constructor(properties?: synctv.source_config.ICloudreveMediaSourceConfig);
            public serverId: string;
            public path: string;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.ICloudreveMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.CloudreveMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITwitchLiveSourceConfig {
            channel?: (string|null);
            shared?: (boolean|null);
        }

        class TwitchLiveSourceConfig implements ITwitchLiveSourceConfig {
            constructor(properties?: synctv.source_config.ITwitchLiveSourceConfig);
            public channel: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.ITwitchLiveSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchLiveSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITwitchVideoSourceConfig {
            videoId?: (string|null);
            shared?: (boolean|null);
        }

        class TwitchVideoSourceConfig implements ITwitchVideoSourceConfig {
            constructor(properties?: synctv.source_config.ITwitchVideoSourceConfig);
            public videoId: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.ITwitchVideoSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchVideoSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITwitchClipSourceConfig {
            slug?: (string|null);
            shared?: (boolean|null);
        }

        class TwitchClipSourceConfig implements ITwitchClipSourceConfig {
            constructor(properties?: synctv.source_config.ITwitchClipSourceConfig);
            public slug: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.ITwitchClipSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchClipSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITwitchMediaSourceConfig {
            live?: (synctv.source_config.ITwitchLiveSourceConfig|null);
            video?: (synctv.source_config.ITwitchVideoSourceConfig|null);
            clip?: (synctv.source_config.ITwitchClipSourceConfig|null);
        }

        class TwitchMediaSourceConfig implements ITwitchMediaSourceConfig {
            constructor(properties?: synctv.source_config.ITwitchMediaSourceConfig);
            public live?: (synctv.source_config.ITwitchLiveSourceConfig|null);
            public video?: (synctv.source_config.ITwitchVideoSourceConfig|null);
            public clip?: (synctv.source_config.ITwitchClipSourceConfig|null);
            public source?: ("live"|"video"|"clip");
            public static encode(message: synctv.source_config.ITwitchMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TwitchMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHuyaLiveSourceConfig {
            roomId?: (string|null);
        }

        class HuyaLiveSourceConfig implements IHuyaLiveSourceConfig {
            constructor(properties?: synctv.source_config.IHuyaLiveSourceConfig);
            public roomId: string;
            public static encode(message: synctv.source_config.IHuyaLiveSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.HuyaLiveSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHuyaVideoSourceConfig {
            videoId?: (string|null);
        }

        class HuyaVideoSourceConfig implements IHuyaVideoSourceConfig {
            constructor(properties?: synctv.source_config.IHuyaVideoSourceConfig);
            public videoId: string;
            public static encode(message: synctv.source_config.IHuyaVideoSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.HuyaVideoSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IHuyaMediaSourceConfig {
            live?: (synctv.source_config.IHuyaLiveSourceConfig|null);
            video?: (synctv.source_config.IHuyaVideoSourceConfig|null);
        }

        class HuyaMediaSourceConfig implements IHuyaMediaSourceConfig {
            constructor(properties?: synctv.source_config.IHuyaMediaSourceConfig);
            public live?: (synctv.source_config.IHuyaLiveSourceConfig|null);
            public video?: (synctv.source_config.IHuyaVideoSourceConfig|null);
            public source?: ("live"|"video");
            public static encode(message: synctv.source_config.IHuyaMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.HuyaMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDouyuMediaSourceConfig {
            room?: (string|null);
        }

        class DouyuMediaSourceConfig implements IDouyuMediaSourceConfig {
            constructor(properties?: synctv.source_config.IDouyuMediaSourceConfig);
            public room: string;
            public static encode(message: synctv.source_config.IDouyuMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DouyuMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDouyinVideoSourceConfig {
            awemeId?: (string|null);
            shared?: (boolean|null);
        }

        class DouyinVideoSourceConfig implements IDouyinVideoSourceConfig {
            constructor(properties?: synctv.source_config.IDouyinVideoSourceConfig);
            public awemeId: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.IDouyinVideoSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DouyinVideoSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDouyinLiveSourceConfig {
            webRid?: (string|null);
            shared?: (boolean|null);
        }

        class DouyinLiveSourceConfig implements IDouyinLiveSourceConfig {
            constructor(properties?: synctv.source_config.IDouyinLiveSourceConfig);
            public webRid: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.IDouyinLiveSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DouyinLiveSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IDouyinMediaSourceConfig {
            video?: (synctv.source_config.IDouyinVideoSourceConfig|null);
            live?: (synctv.source_config.IDouyinLiveSourceConfig|null);
        }

        class DouyinMediaSourceConfig implements IDouyinMediaSourceConfig {
            constructor(properties?: synctv.source_config.IDouyinMediaSourceConfig);
            public video?: (synctv.source_config.IDouyinVideoSourceConfig|null);
            public live?: (synctv.source_config.IDouyinLiveSourceConfig|null);
            public source?: ("video"|"live");
            public static encode(message: synctv.source_config.IDouyinMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.DouyinMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAcFunVideoSourceConfig {
            videoId?: (string|null);
        }

        class AcFunVideoSourceConfig implements IAcFunVideoSourceConfig {
            constructor(properties?: synctv.source_config.IAcFunVideoSourceConfig);
            public videoId: string;
            public static encode(message: synctv.source_config.IAcFunVideoSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.AcFunVideoSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAcFunBangumiSourceConfig {
            bangumiId?: (string|null);
            episodeQuery?: (string|null);
        }

        class AcFunBangumiSourceConfig implements IAcFunBangumiSourceConfig {
            constructor(properties?: synctv.source_config.IAcFunBangumiSourceConfig);
            public bangumiId: string;
            public episodeQuery?: (string|null);
            public _episodeQuery?: "episodeQuery";
            public static encode(message: synctv.source_config.IAcFunBangumiSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.AcFunBangumiSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAcFunLiveSourceConfig {
            authorId?: (string|null);
        }

        class AcFunLiveSourceConfig implements IAcFunLiveSourceConfig {
            constructor(properties?: synctv.source_config.IAcFunLiveSourceConfig);
            public authorId: string;
            public static encode(message: synctv.source_config.IAcFunLiveSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.AcFunLiveSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IAcFunMediaSourceConfig {
            video?: (synctv.source_config.IAcFunVideoSourceConfig|null);
            bangumi?: (synctv.source_config.IAcFunBangumiSourceConfig|null);
            live?: (synctv.source_config.IAcFunLiveSourceConfig|null);
        }

        class AcFunMediaSourceConfig implements IAcFunMediaSourceConfig {
            constructor(properties?: synctv.source_config.IAcFunMediaSourceConfig);
            public video?: (synctv.source_config.IAcFunVideoSourceConfig|null);
            public bangumi?: (synctv.source_config.IAcFunBangumiSourceConfig|null);
            public live?: (synctv.source_config.IAcFunLiveSourceConfig|null);
            public source?: ("video"|"bangumi"|"live");
            public static encode(message: synctv.source_config.IAcFunMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.AcFunMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ICctvMediaSourceConfig {
            resource?: (string|null);
        }

        class CctvMediaSourceConfig implements ICctvMediaSourceConfig {
            constructor(properties?: synctv.source_config.ICctvMediaSourceConfig);
            public resource: string;
            public static encode(message: synctv.source_config.ICctvMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.CctvMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosFileSourceConfig {
            path?: (string|null);
        }

        class FnosFileSourceConfig implements IFnosFileSourceConfig {
            constructor(properties?: synctv.source_config.IFnosFileSourceConfig);
            public path: string;
            public static encode(message: synctv.source_config.IFnosFileSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosFileSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosLibraryItemSourceConfig {
            itemGuid?: (string|null);
            mediaGuid?: (string|null);
        }

        class FnosLibraryItemSourceConfig implements IFnosLibraryItemSourceConfig {
            constructor(properties?: synctv.source_config.IFnosLibraryItemSourceConfig);
            public itemGuid: string;
            public mediaGuid?: (string|null);
            public _mediaGuid?: "mediaGuid";
            public static encode(message: synctv.source_config.IFnosLibraryItemSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosLibraryItemSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IFnosMediaSourceConfig {
            serverId?: (string|null);
            file?: (synctv.source_config.IFnosFileSourceConfig|null);
            libraryItem?: (synctv.source_config.IFnosLibraryItemSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class FnosMediaSourceConfig implements IFnosMediaSourceConfig {
            constructor(properties?: synctv.source_config.IFnosMediaSourceConfig);
            public serverId: string;
            public file?: (synctv.source_config.IFnosFileSourceConfig|null);
            public libraryItem?: (synctv.source_config.IFnosLibraryItemSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("file"|"libraryItem");
            public static encode(message: synctv.source_config.IFnosMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.FnosMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IQnapMediaSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class QnapMediaSourceConfig implements IQnapMediaSourceConfig {
            constructor(properties?: synctv.source_config.IQnapMediaSourceConfig);
            public serverId: string;
            public path: string;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.IQnapMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.QnapMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyFileSourceConfig {
            path?: (string|null);
        }

        class SynologyFileSourceConfig implements ISynologyFileSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyFileSourceConfig);
            public path: string;
            public static encode(message: synctv.source_config.ISynologyFileSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyFileSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyLibraryItemSourceConfig {
            kind?: (synctv.source_config.SynologyLibraryItemKind|null);
            itemId?: (number|Long|null);
            fileId?: (number|Long|null);
        }

        class SynologyLibraryItemSourceConfig implements ISynologyLibraryItemSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyLibraryItemSourceConfig);
            public kind: synctv.source_config.SynologyLibraryItemKind;
            public itemId: (number|Long);
            public fileId: (number|Long);
            public static encode(message: synctv.source_config.ISynologyLibraryItemSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyLibraryItemSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISynologyMediaSourceConfig {
            serverId?: (string|null);
            file?: (synctv.source_config.ISynologyFileSourceConfig|null);
            libraryItem?: (synctv.source_config.ISynologyLibraryItemSourceConfig|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class SynologyMediaSourceConfig implements ISynologyMediaSourceConfig {
            constructor(properties?: synctv.source_config.ISynologyMediaSourceConfig);
            public serverId: string;
            public file?: (synctv.source_config.ISynologyFileSourceConfig|null);
            public libraryItem?: (synctv.source_config.ISynologyLibraryItemSourceConfig|null);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public source?: ("file"|"libraryItem");
            public static encode(message: synctv.source_config.ISynologyMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SynologyMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface INextcloudMediaSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            fileId?: (number|Long|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class NextcloudMediaSourceConfig implements INextcloudMediaSourceConfig {
            constructor(properties?: synctv.source_config.INextcloudMediaSourceConfig);
            public serverId: string;
            public path: string;
            public fileId: (number|Long);
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.INextcloudMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.NextcloudMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ISeafileMediaSourceConfig {
            serverId?: (string|null);
            repositoryId?: (string|null);
            path?: (string|null);
            objectId?: (string|null);
            hasThumbnail?: (boolean|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class SeafileMediaSourceConfig implements ISeafileMediaSourceConfig {
            constructor(properties?: synctv.source_config.ISeafileMediaSourceConfig);
            public serverId: string;
            public repositoryId: string;
            public path: string;
            public objectId: string;
            public hasThumbnail: boolean;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.ISeafileMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.SeafileMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITrueNasMediaSourceConfig {
            serverId?: (string|null);
            path?: (string|null);
            proxyMode?: (synctv.source_config.PlaybackProxyMode|null);
        }

        class TrueNasMediaSourceConfig implements ITrueNasMediaSourceConfig {
            constructor(properties?: synctv.source_config.ITrueNasMediaSourceConfig);
            public serverId: string;
            public path: string;
            public proxyMode: synctv.source_config.PlaybackProxyMode;
            public static encode(message: synctv.source_config.ITrueNasMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TrueNasMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IYoutubeMediaSourceConfig {
            videoId?: (string|null);
            shared?: (boolean|null);
        }

        class YoutubeMediaSourceConfig implements IYoutubeMediaSourceConfig {
            constructor(properties?: synctv.source_config.IYoutubeMediaSourceConfig);
            public videoId: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.IYoutubeMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.YoutubeMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITikTokVideoSourceConfig {
            videoId?: (string|null);
            shared?: (boolean|null);
        }

        class TikTokVideoSourceConfig implements ITikTokVideoSourceConfig {
            constructor(properties?: synctv.source_config.ITikTokVideoSourceConfig);
            public videoId: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.ITikTokVideoSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TikTokVideoSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITikTokLiveSourceConfig {
            uniqueId?: (string|null);
            shared?: (boolean|null);
        }

        class TikTokLiveSourceConfig implements ITikTokLiveSourceConfig {
            constructor(properties?: synctv.source_config.ITikTokLiveSourceConfig);
            public uniqueId: string;
            public shared: boolean;
            public static encode(message: synctv.source_config.ITikTokLiveSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TikTokLiveSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface ITikTokMediaSourceConfig {
            video?: (synctv.source_config.ITikTokVideoSourceConfig|null);
            live?: (synctv.source_config.ITikTokLiveSourceConfig|null);
        }

        class TikTokMediaSourceConfig implements ITikTokMediaSourceConfig {
            constructor(properties?: synctv.source_config.ITikTokMediaSourceConfig);
            public video?: (synctv.source_config.ITikTokVideoSourceConfig|null);
            public live?: (synctv.source_config.ITikTokLiveSourceConfig|null);
            public source?: ("video"|"live");
            public static encode(message: synctv.source_config.ITikTokMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.TikTokMediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        interface IMediaSourceConfig {
            directUrl?: (synctv.source_config.IDirectUrlMediaSourceConfig|null);
            bilibili?: (synctv.source_config.IBilibiliMediaSourceConfig|null);
            alist?: (synctv.source_config.IAlistMediaSourceConfig|null);
            emby?: (synctv.source_config.IEmbyMediaSourceConfig|null);
            rtmp?: (synctv.source_config.IRtmpMediaSourceConfig|null);
            liveProxy?: (synctv.source_config.ILiveProxyMediaSourceConfig|null);
            cloudreve?: (synctv.source_config.ICloudreveMediaSourceConfig|null);
            twitch?: (synctv.source_config.ITwitchMediaSourceConfig|null);
            huya?: (synctv.source_config.IHuyaMediaSourceConfig|null);
            douyu?: (synctv.source_config.IDouyuMediaSourceConfig|null);
            douyin?: (synctv.source_config.IDouyinMediaSourceConfig|null);
            acFun?: (synctv.source_config.IAcFunMediaSourceConfig|null);
            cctv?: (synctv.source_config.ICctvMediaSourceConfig|null);
            fnos?: (synctv.source_config.IFnosMediaSourceConfig|null);
            qnap?: (synctv.source_config.IQnapMediaSourceConfig|null);
            synology?: (synctv.source_config.ISynologyMediaSourceConfig|null);
            nextcloud?: (synctv.source_config.INextcloudMediaSourceConfig|null);
            seafile?: (synctv.source_config.ISeafileMediaSourceConfig|null);
            truenas?: (synctv.source_config.ITrueNasMediaSourceConfig|null);
            youtube?: (synctv.source_config.IYoutubeMediaSourceConfig|null);
            tiktok?: (synctv.source_config.ITikTokMediaSourceConfig|null);
        }

        class MediaSourceConfig implements IMediaSourceConfig {
            constructor(properties?: synctv.source_config.IMediaSourceConfig);
            public directUrl?: (synctv.source_config.IDirectUrlMediaSourceConfig|null);
            public bilibili?: (synctv.source_config.IBilibiliMediaSourceConfig|null);
            public alist?: (synctv.source_config.IAlistMediaSourceConfig|null);
            public emby?: (synctv.source_config.IEmbyMediaSourceConfig|null);
            public rtmp?: (synctv.source_config.IRtmpMediaSourceConfig|null);
            public liveProxy?: (synctv.source_config.ILiveProxyMediaSourceConfig|null);
            public cloudreve?: (synctv.source_config.ICloudreveMediaSourceConfig|null);
            public twitch?: (synctv.source_config.ITwitchMediaSourceConfig|null);
            public huya?: (synctv.source_config.IHuyaMediaSourceConfig|null);
            public douyu?: (synctv.source_config.IDouyuMediaSourceConfig|null);
            public douyin?: (synctv.source_config.IDouyinMediaSourceConfig|null);
            public acFun?: (synctv.source_config.IAcFunMediaSourceConfig|null);
            public cctv?: (synctv.source_config.ICctvMediaSourceConfig|null);
            public fnos?: (synctv.source_config.IFnosMediaSourceConfig|null);
            public qnap?: (synctv.source_config.IQnapMediaSourceConfig|null);
            public synology?: (synctv.source_config.ISynologyMediaSourceConfig|null);
            public nextcloud?: (synctv.source_config.INextcloudMediaSourceConfig|null);
            public seafile?: (synctv.source_config.ISeafileMediaSourceConfig|null);
            public truenas?: (synctv.source_config.ITrueNasMediaSourceConfig|null);
            public youtube?: (synctv.source_config.IYoutubeMediaSourceConfig|null);
            public tiktok?: (synctv.source_config.ITikTokMediaSourceConfig|null);
            public provider?: ("directUrl"|"bilibili"|"alist"|"emby"|"rtmp"|"liveProxy"|"cloudreve"|"twitch"|"huya"|"douyu"|"douyin"|"acFun"|"cctv"|"fnos"|"qnap"|"synology"|"nextcloud"|"seafile"|"truenas"|"youtube"|"tiktok");
            public static encode(message: synctv.source_config.IMediaSourceConfig, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.source_config.MediaSourceConfig;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    namespace common {

        enum RoomMemberRole {
            ROOM_MEMBER_ROLE_UNSPECIFIED = 0,
            ROOM_MEMBER_ROLE_CREATOR = 1,
            ROOM_MEMBER_ROLE_ADMIN = 2,
            ROOM_MEMBER_ROLE_MEMBER = 3,
            ROOM_MEMBER_ROLE_GUEST = 4
        }

        interface IRoomMember {
            roomId?: (string|null);
            userId?: (string|null);
            username?: (string|null);
            role?: (synctv.common.RoomMemberRole|null);
            permissions?: (number|Long|null);
            addedPermissions?: (number|Long|null);
            removedPermissions?: (number|Long|null);
            adminAddedPermissions?: (number|Long|null);
            adminRemovedPermissions?: (number|Long|null);
            joinedAt?: (number|Long|null);
            isOnline?: (boolean|null);
            connectionCount?: (number|null);
            remarkName?: (string|null);
            displayTag?: (string|null);
        }

        class RoomMember implements IRoomMember {
            constructor(properties?: synctv.common.IRoomMember);
            public roomId: string;
            public userId: string;
            public username: string;
            public role: synctv.common.RoomMemberRole;
            public permissions: (number|Long);
            public addedPermissions: (number|Long);
            public removedPermissions: (number|Long);
            public adminAddedPermissions: (number|Long);
            public adminRemovedPermissions: (number|Long);
            public joinedAt: (number|Long);
            public isOnline: boolean;
            public connectionCount: number;
            public remarkName: string;
            public displayTag: string;
            public static encode(message: synctv.common.IRoomMember, writer?: $protobuf.Writer): $protobuf.Writer;
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): synctv.common.RoomMember;
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
