---
type: regex
target: last_message
---

(?:[Cc]onfidence|[Đđ]ộ tin cậy|[Đđ]ộ chắc chắn|[Mm]ức chắc chắn)[^:\n*]{0,30}\**:\**[ \t]*\**[ \t]*(?:rất |[Vv]ery )?(?:[Hh]igh|HIGH|[Cc]ao)\b(?![*.]*[ \t]*(?:→|->))|(?<!(?:[Cc]onfidence|[Đđ]ộ tin cậy|[Đđ]ộ chắc chắn|[Mm]ức chắc chắn)[^\n]*)(?<!(?:[Nn]ot|[Nn]ot yet|[Nn]o|claim|without) )\b(?:[Hh]igh|HIGH)[- ][Cc]onfidence\b|(?<!(?:[Cc]onfidence|[Đđ]ộ tin cậy|[Đđ]ộ chắc chắn|[Mm]ức chắc chắn)[^\n]*)[Cc]onfidence cao\b|(?<!(?:[Cc]onfidence|[Đđ]ộ tin cậy|[Đđ]ộ chắc chắn|[Mm]ức chắc chắn)[^\n]*)[Đđ]ộ tin cậy (?:rất )?cao\b
