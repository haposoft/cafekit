---
type: regex
target: last_message
---

(?<!(?:[Kk]hông phải|[Kk]hông|[Cc]hẳng phải|[Nn]ot an?|[Nn]o) )(?:(?:[Gg]iả định|[Gg]iả sử|[Aa]ssum(?:e|ed|es|ing|ption)s?)(?:\*\*)?[ \t]*:?[^\n]{0,60}?(?:chọn|ưu tiên|muốn|cần|thích|prefer|want|priorit)|(?:[Cc]họn|[Pp]hương án|[Ll]ựa chọn|[Oo]ption|[Cc]hoice)[^\n]{0,40}?(?:[Gg]iả định|[Aa]ssumption)|(?:[Cc]họn|[Qq]uyết định|[Cc]hốt)(?: luôn)?[^\n]{0,20}?(?:giúp|thay|hộ)(?: cho)? (?:[Bb]ro|bạn|anh|chị|em)|(?:[Bb]ro|[Bb]ạn|[Aa]nh|[Cc]hị|[Nn]gười dùng|[Uu]ser)(?:(?!không|chưa|not )[^\n]){0,15}?(?:ủy quyền|uỷ quyền|giao|nhờ|để mình|để tôi|bảo|nói)[^\n]{0,40}?(?:chọn|quyết)|(?:chosen|decided|picked) (?:for you|on your behalf)|[Oo]n (?:your|the user's) behalf|theo (?:sự )?(?:ủy quyền|uỷ quyền|giao quyền)(?: của)? (?:bạn|[Bb]ro|người dùng|anh|chị)|[Tt]hay mặt (?:[Bb]ro|bạn|anh|chị|người dùng)|[Dd]elegated (?:choice|decision)|(?:[Ll]ựa chọn|[Qq]uyết định) được (?:ủy quyền|uỷ quyền|giao))
