---
type: regex
target: last_message
match: not_contains
---

(?:^|[.!?](?=[ \t\n]|$)|\n)(?:(?!(?:(?<![A-Za-zÀ-ỹ])(?:[Kk]hông|[Cc]hưa|[Nn]ot|[Nn]o|[Ww]ithout|[Nn]othing)(?![A-Za-zÀ-ỹ])|n't|(?<![0-9])0 (?:kết quả|results?|matches)|✗))(?:[^.!?\n]|[.!?](?![ \t\n]|$)))*(?:[Pp]ostgre(?:SQL|sql)|[Pp]ostgres|[Mm]y[Ss][Qq][Ll]|[Mm]ongo(?:[Dd][Bb])?|[Rr]edis|[Ss][Qq][Ll]ite)(?:(?!(?:(?<![A-Za-zÀ-ỹ])(?:[Kk]hông|[Cc]hưa|[Nn]ot|[Nn]o|[Ww]ithout|[Nn]othing)(?![A-Za-zÀ-ỹ])|n't|(?<![0-9])0 (?:kết quả|results?|matches)|✗))(?:[^.!?\n]|[.!?](?![ \t\n]|$)))*(?=[.!?](?:[ \t\n]|$)|\n|$)
