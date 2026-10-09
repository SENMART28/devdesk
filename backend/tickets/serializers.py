from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Ticket, Comment

User = get_user_model()


class UserShortSerializer(serializers.ModelSerializer):
    """Минималистичное представление пользователя для внешних ключей."""
    class Meta:
        model = User
        fields = ('id', 'username', 'role')
        read_only_fields = fields


class CommentSerializer(serializers.ModelSerializer):
    author = UserShortSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'ticket', 'author', 'text', 'created_at')
        read_only_fields = ('id', 'ticket', 'author', 'created_at')


class TicketListSerializer(serializers.ModelSerializer):
    author = UserShortSerializer(read_only=True)
    assignee = UserShortSerializer(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Ticket
        fields = (
            'id',
            'title',
            'status',
            'priority',
            'author',
            'assignee',
            'comments_count',
            'created_at',
            'updated_at',
        )


class TicketDetailSerializer(serializers.ModelSerializer):
    author = UserShortSerializer(read_only=True)
    assignee = UserShortSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = (
            'id',
            'title',
            'description',
            'status',
            'priority',
            'author',
            'assignee',
            'comments',
            'created_at',
            'updated_at',
        )


class TicketCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ('id', 'title', 'description', 'priority', 'status', 'assignee')

    def validate(self, attrs):
        user = self.context['request'].user
        instance = getattr(self, 'instance', None)

        if 'assignee' in attrs and not user.is_support():
            raise serializers.ValidationError({
                'assignee': 'Обычные клиенты не могут назначать ответственного.'
            })

        if instance and 'status' in attrs:
            new_status = attrs['status']
            old_status = instance.status

            if new_status != old_status:
                if not user.is_support():
                    if old_status == Ticket.Status.RESOLVED and new_status == Ticket.Status.CLOSED:
                        pass
                    else:
                        raise serializers.ValidationError({
                            'status': 'Клиент может переводить в статус "Закрыт" только решённые тикеты.'
                        })

                if old_status == Ticket.Status.CLOSED:
                    raise serializers.ValidationError({
                        'status': 'Закрытый тикет нельзя переоткрыть.'
                    })

        return attrs