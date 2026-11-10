import {
  lichessStudyChapterTitle,
  lichessStudyErrorMessage,
  lichessStudyPgnUrl,
  parseLichessStudyChapters,
  parseLichessStudyUrl,
} from './lichessStudy'

describe('parseLichessStudyUrl', () => {
  it('reads study and chapter links', () => {
    expect(parseLichessStudyUrl('https://lichess.org/study/1wzY0YmD')).toEqual({
      studyId: '1wzY0YmD',
    })
    expect(
      parseLichessStudyUrl('  lichess.org/study/1wzY0YmD/oOEEUJjV#12 '),
    ).toEqual({ studyId: '1wzY0YmD', chapterId: 'oOEEUJjV' })
    expect(
      parseLichessStudyUrl(
        'https://www.lichess.org/study/embed/1wzY0YmD/oOEEUJjV',
      ),
    ).toEqual({ studyId: '1wzY0YmD', chapterId: 'oOEEUJjV' })
    expect(parseLichessStudyUrl('https://lichess.org/study/1wzY0YmD/')).toEqual(
      {
        studyId: '1wzY0YmD',
      },
    )
  })

  it('rejects other links and text', () => {
    expect(parseLichessStudyUrl('https://lichess.org/abcd1234')).toBeNull()
    expect(
      parseLichessStudyUrl('https://lichess.org/study/by/thibault'),
    ).toBeNull()
    expect(
      parseLichessStudyUrl('https://example.com/study/1wzY0YmD'),
    ).toBeNull()
    expect(parseLichessStudyUrl('1. e4 e5')).toBeNull()
  })
})

describe('lichessStudyPgnUrl', () => {
  it('asks for a chapter, or the whole study', () => {
    expect(lichessStudyPgnUrl({ studyId: 'a1b2c3d4' })).toBe(
      'https://lichess.org/api/study/a1b2c3d4.pgn',
    )
    expect(
      lichessStudyPgnUrl({ studyId: 'a1b2c3d4', chapterId: 'e5f6g7h8' }),
    ).toBe('https://lichess.org/api/study/a1b2c3d4/e5f6g7h8.pgn')
  })
})

describe('lichessStudyErrorMessage', () => {
  it('says a study is private when Lichess refuses it', () => {
    expect(lichessStudyErrorMessage(403, { studyId: 'a1b2c3d4' })).toMatch(
      /private/,
    )
    expect(lichessStudyErrorMessage(401, { studyId: 'a1b2c3d4' })).toMatch(
      /private/,
    )
    expect(
      lichessStudyErrorMessage(404, { studyId: 'a', chapterId: 'b' }),
    ).toMatch(/chapter/)
  })
})

describe('parseLichessStudyChapters', () => {
  const text = `[Event "Openings: Italian"]
[StudyName "Openings"]
[ChapterName "Italian"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 *


[Event "Openings: House"]
[StudyName "Openings"]
[ChapterName "House"]
[Variant "Crazyhouse"]

1. e4 *
`

  it('lists the chapters, marking variants', () => {
    const chapters = parseLichessStudyChapters(text)
    expect(chapters.map((chapter) => chapter.name)).toEqual([
      'Italian',
      'House',
    ])
    expect(chapters.map((chapter) => chapter.isStandard)).toEqual([true, false])
    expect(chapters[0].pgn).toContain('3. Bc4')
    expect(lichessStudyChapterTitle(chapters[0])).toBe('Openings: Italian')
  })
})
