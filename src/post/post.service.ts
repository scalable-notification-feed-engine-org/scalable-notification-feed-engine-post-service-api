import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class PostService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    @Inject('POST_KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.kafkaClient.subscribeToResponseOf('post.created');
    await this.kafkaClient.connect();
  }

  async create(createPostDto: CreatePostDto) {
    try {
      const newPost = await this.prisma.post.create({
        data: {
          content: createPostDto.content,
          userId: createPostDto.author.id,
          tenantId: createPostDto.tenantId,
        },
      });

      const kafkaPost = {
        id: newPost.id,
        content: newPost.content,
        userId: newPost.userId,
        tenantId: newPost.tenantId,
        createdAt: newPost.createdAt,
        updatedAt: newPost.updatedAt,
        likeCount: newPost.likeCount,
        isLike: false,
        commentCount: newPost.commentCount,
      };

      if (newPost) {
        this.kafkaClient.emit('post.created', kafkaPost);
      }

      return newPost;
    } catch (error) {
      console.error('Error creating post or publishing to Kafka:', error);
      throw error;
    }
  }

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
      isLike: post.likes.length > 0,
    }));
  }

  async toggleLike(postId: string, userId: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existingLike = await tx.like.findUnique({
          where: { userId_postId: { userId, postId } },
        });
        if (existingLike) {
          await tx.like.delete({ where: { id: existingLike.id } });
          await tx.post.update({
            where: { id: postId },
            data: { likeCount: { decrement: 1 } },
          });
          return { isLiked: false };
        }

        await tx.like.create({ data: { postId, userId } });
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        });
        return { isLiked: true };
      });

      const savedPost = await this.prisma.post.findUnique({
        where: {
          id: postId,
        },
      });

      if (!savedPost) {
        return;
      }

      const data = {
        postId: postId,
        userId: userId,
        likeCount: savedPost.likeCount,
        isLike: result.isLiked,
      };

      this.kafkaClient.emit('post.liked', data);

      return savedPost;
    } catch (error) {
      console.error(error);
    }
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
