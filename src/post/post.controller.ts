import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postService.create(createPostDto);
  }

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.postService.findAll(userId);
  }

  @Post(':id/like')
  async togglePostLike(
    @Param('id') postId: string,
    @Body('userId') userId: string,
  ) {
    return await this.postService.toggleLike(postId, userId);
  }

  @Post(':id/comment')
  async addComment(
    @Param('id') postId: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return await this.postService.addComment(
      postId,
      createCommentDto.userId,
      createCommentDto.content,
    );
  }
}
