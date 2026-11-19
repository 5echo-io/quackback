import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { withApiKeyAuth } from '@/lib/server/domains/api/auth'
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  notFoundResponse,
  handleDomainError,
  parsePaginationParams,
} from '@/lib/server/domains/api/responses'
import { parseOptionalTypeId } from '@/lib/server/domains/api/validation'
import { isFeatureEnabled } from '@/lib/server/domains/settings/settings.service'
import { listArticles, createArticle } from '@/lib/server/domains/help-center/help-center.service'
import { contentJsonToMarkdown } from '@/lib/server/markdown-tiptap'
import type { TiptapContent } from '@/lib/server/db'
import { helpCenterLocaleSchema, translationGroupSchema } from '@/lib/shared/schemas/help-center'
import type { PrincipalId } from '@quackback/ids'

const createArticleBody = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  slug: z.string().max(200).optional(),
  description: z.string().max(300).optional(),
  authorId: z.string().optional(),
  /** The language the article is written in; the help center's default when left out. */
  locale: helpCenterLocaleSchema.optional(),
  /** Shared by an article and its translations, one per language. */
  translationGroup: translationGroupSchema.nullable().optional(),
})

function formatArticle(article: {
  id: string
  slug: string
  locale: string
  translationGroup: string | null
  title: string
  description: string | null
  content: string
  contentJson: TiptapContent | null
  publishedAt: Date | null
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  createdAt: Date
  updatedAt: Date
  category: { id: string; slug: string; name: string }
  author: { id: string; name: string; avatarUrl: string | null } | null
}) {
  return {
    id: article.id,
    slug: article.slug,
    locale: article.locale,
    translationGroup: article.translationGroup,
    title: article.title,
    description: article.description,
    // Render markdown from the canonical contentJson so images survive; falls
    // back to the stored column for legacy rows (and the list query, which
    // omits contentJson for performance).
    content: contentJsonToMarkdown(article.contentJson, article.content),
    publishedAt: article.publishedAt?.toISOString() || null,
    viewCount: article.viewCount,
    helpfulCount: article.helpfulCount,
    notHelpfulCount: article.notHelpfulCount,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    category: article.category,
    author: article.author,
  }
}

export const Route = createFileRoute('/api/v1/help-center/articles/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isFeatureEnabled('helpCenter'))) return notFoundResponse('Knowledge base')

        try {
          await withApiKeyAuth(request, { role: 'team' })

          const url = new URL(request.url)
          const { cursor, limit } = parsePaginationParams(url)
          const categoryId = url.searchParams.get('categoryId') ?? undefined
          const status = (url.searchParams.get('status') as 'draft' | 'published' | 'all') ?? 'all'
          const search = url.searchParams.get('search') ?? undefined
          const localeParam = url.searchParams.get('locale')
          const locale = localeParam ? helpCenterLocaleSchema.safeParse(localeParam) : null
          if (locale && !locale.success) {
            return badRequestResponse('Unknown locale', { errors: { locale: [localeParam] } })
          }

          const result = await listArticles({
            categoryId,
            status,
            search,
            cursor,
            limit,
            locale: locale?.data,
          })

          return successResponse(result.items.map(formatArticle), {
            pagination: {
              cursor: result.nextCursor,
              hasMore: result.hasMore,
            },
          })
        } catch (error) {
          return handleDomainError(error)
        }
      },

      POST: async ({ request }) => {
        if (!(await isFeatureEnabled('helpCenter'))) return notFoundResponse('Knowledge base')

        try {
          const { principalId } = await withApiKeyAuth(request, { role: 'team' })

          const body = await request.json()
          const parsed = createArticleBody.safeParse(body)

          if (!parsed.success) {
            return badRequestResponse('Invalid request body', {
              errors: parsed.error.flatten().fieldErrors,
            })
          }

          const { authorId, ...articleData } = parsed.data

          const authorPrincipalId = parseOptionalTypeId<PrincipalId>(
            authorId,
            'principal',
            'author ID'
          )

          const article = await createArticle(
            articleData,
            principalId as PrincipalId,
            authorPrincipalId
          )
          return createdResponse(formatArticle(article))
        } catch (error) {
          return handleDomainError(error)
        }
      },
    },
  },
})
