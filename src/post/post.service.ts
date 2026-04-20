import { Injectable } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async create(createPostDto: CreatePostDto) {
    return await this.prisma.post.create({
      data: {
        content: createPostDto.content,
        userId: createPostDto.userId,
        tenantId: createPostDto.tenantId,
      },
    });
  }
  // tenantId: string,
  async findAll(currentUserId: string) {
    const posts = await this.prisma.post.findMany({
      include: {
        likes: {
          where: { userId: currentUserId },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return posts.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
    }));
  }

  async toggleLike(postId: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findUnique({
        where: { userId_postId: { userId, postId } },
      });
      if (existingLike) {
        await tx.like.delete({ where: { id: existingLike.id } });
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        });
        return { like: false };
      }

      await tx.like.create({ data: { postId, userId } });
      await tx.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
      return { like: true };
    });
  }

  async addComment(postId: string, userId: string, content: string) {
    return await this.prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          postId: postId,
          userId: userId,
          content: content,
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      return newComment;
    });
  }
}
