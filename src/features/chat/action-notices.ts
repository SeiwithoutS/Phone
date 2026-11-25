// Match the app's old notice templates so names and user- or character-written text stay intact.
const legacyNotices: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\[(.+?)的状态已更新为[:：] ?([\s\S]*)\]$/, '[$1 updated their status: $2]'],
  [/^(.+?) 拍了拍我([\s\S]*)$/, '$1 nudged you$2'],
  [/^(.+?) 拍了拍 “([^”]+)”([\s\S]*)$/, '$1 nudged “$2”$3'],
  [/^[“"](.+?)[”"] 将对你的称呼修改为 [“"]([\s\S]*)[”"]$/, '“$1” changed your nickname to “$2”'],
  [/^“(.+?)” 将备注修改为 “([\s\S]*)”$/, '“$1” changed their display name to “$2”'],
  [/^\[(.+?) 更换了头像\]$/, '[$1 changed their avatar]'],
  [/^\[(.+?) 更换了你的头像\]$/, '[$1 changed your avatar]'],
  [/^\[♪ (.+?) 为你切歌[:：] 《(.+?)》 - ([\s\S]*)\]$/, '[♪ $1 changed the song to “$2” - $3]'],
  [/^你领取了 (.+?) 的红包$/, 'You claimed a share of $1’s red packet'],
  [/^(.+?) 领取了 (.+?) 的红包$/, '$1 claimed a share of $2’s red packet'],
  [/^(.+?) 的红包已被领完$/, '$1’s red packet has been fully claimed'],
  [/^(.+?) 将群名修改为 “([\s\S]*)”$/, '$1 changed the group name to “$2”'],
  [/^(.+?) 更换了群头像$/, '$1 changed the group avatar'],
  [/^(.+?) 发布了一条新公告$/, '$1 published a new announcement'],
  [/^你通过了“(.+?)”的好友请求$/, 'You accepted “$1”’s friend request'],
]

const vietnameseNotices: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\[(.+?) updated their status: ([\s\S]*)\]$/, '[$1 đã cập nhật trạng thái: $2]'],
  [/^(.+?) nudged you([\s\S]*)$/, '$1 đã vỗ nhẹ vào bạn$2'],
  [/^(.+?) nudged “([^”]+)”([\s\S]*)$/, '$1 đã vỗ nhẹ vào “$2”$3'],
  [/^[“"](.+?)[”"] changed your nickname to [“"]([\s\S]*)[”"]$/, '“$1” đã đổi biệt danh của bạn thành “$2”'],
  [/^“(.+?)” changed their display name to “([\s\S]*)”$/, '“$1” đã đổi tên hiển thị thành “$2”'],
  [/^\[(.+?) changed their avatar\]$/, '[$1 đã đổi ảnh đại diện]'],
  [/^\[(.+?) changed your avatar\]$/, '[$1 đã đổi ảnh đại diện của bạn]'],
  [/^\[♪ (.+?) changed the song to “(.+?)” - ([\s\S]*)\]$/, '[♪ $1 đã chuyển sang bài “$2” - $3]'],
  [/^You claimed a share of (.+?)['’]s red packet$/, 'Bạn đã nhận một phần lì xì của $1'],
  [/^(.+?) claimed (?:a share|part) of (.+?)[’']s red packet$/, '$1 đã nhận một phần lì xì của $2'],
  [/^(.+?)[’']s red packet has been fully claimed$/, 'Lì xì của $1 đã được nhận hết'],
  [/^(.+?) changed the group name to “([\s\S]*)”$/, '$1 đã đổi tên nhóm thành “$2”'],
  [/^(.+?) changed the group avatar$/, '$1 đã đổi ảnh đại diện nhóm'],
  [/^(.+?) published a new announcement$/, '$1 đã đăng thông báo mới'],
  [/^You accepted “(.+?)”’s friend request$/, 'Bạn đã chấp nhận lời mời kết bạn của “$1”'],
  [/^\[(.+?) published a post\]$/, '[$1 đã đăng bài]'],
  [/^\[(.+?) commented on a post\]$/, '[$1 đã bình luận về một bài viết]'],
  [/^\[(.+?) liked a post\]$/, '[$1 đã thích một bài viết]'],
]

export function formatChatActionNotice({ role, type, content }: { role?: string; type?: string; content?: unknown }, language?: 'en' | 'vi') {
  const text = String(content ?? '')
  if (type === 'recalled_message') {
    if (text === '你撤回了一条消息' || text === 'You recalled a message.') {
      return language === 'vi' ? 'Bạn đã thu hồi một tin nhắn.' : 'You recalled a message.'
    }
    if (text === '对方撤回了一条消息' || text === 'The character recalled a message.') {
      return language === 'vi' ? 'Đối phương đã thu hồi một tin nhắn.' : 'The character recalled a message.'
    }
  }
  if (role === 'system' && type === 'app_action_status' && language === 'vi') {
    return text.replace(/^Marketplace order failed: /, 'Đặt hàng thất bại: ')
      .replace(/^Bank transfer failed: /, 'Chuyển khoản thất bại: ')
  }
  if (role !== 'system' || type !== 'pat_message') return text

  const notice = legacyNotices.find(([pattern]) => pattern.test(text))
  const english = notice ? text.replace(...notice) : text
  if (language !== 'vi') return english
  const vietnamese = vietnameseNotices.find(([pattern]) => pattern.test(english))
  return vietnamese ? english.replace(...vietnamese) : english
}
