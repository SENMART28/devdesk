from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Ticket
from .permissions import IsSupportUser, IsTicketParticipantOrSupport
from .serializers import (
    CommentSerializer,
    TicketCreateUpdateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
)


class TicketViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assignee']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'priority']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['assign_to_me']:
            permission_classes = [IsSupportUser]
        else:
            permission_classes = [IsTicketParticipantOrSupport]
        return [perm() for perm in permission_classes]

    def get_queryset(self):
        user = self.request.user

        qs = Ticket.objects.select_related('author', 'assignee').annotate(
            comments_count=Count('comments')
        )

        if self.action == 'retrieve':
            qs = qs.prefetch_related('comments__author')

        if user.is_support():
            return qs
        return qs.filter(author=user)

    def get_serializer_class(self):
        if self.action == 'list':
            return TicketListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return TicketCreateUpdateSerializer
        return TicketDetailSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'], url_path='comments')
    def add_comment(self, request, pk=None):
        ticket = self.get_object()
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(author=request.user, ticket=ticket)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='assign-me')
    def assign_to_me(self, request, pk=None):
        ticket = self.get_object()
        ticket.assignee = request.user
        if ticket.status == Ticket.Status.NEW:
            ticket.status = Ticket.Status.IN_PROGRESS
        ticket.save(update_fields=['assignee', 'status', 'updated_at'])
        
        return Response(TicketDetailSerializer(ticket).data)