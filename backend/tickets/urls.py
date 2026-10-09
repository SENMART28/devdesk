from rest_framework.routers import DefaultRouter
from .views import TicketViewSet

router = DefaultRouter()
router.register(r'tickets', TicketViewSet, basename='ticket')

urlpatterns = router.urls


# urlpatterns = [
#     path('tickets/', TicketViewSet.as_view({'get': 'list', 'post': 'create'}), name='ticket-list'),
#     path('tickets/<int:pk>/', TicketViewSet.as_view({
#         'get': 'retrieve', 
#         'put': 'update', 
#         'patch': 'partial_update', 
#         'delete': 'destroy'
#     }), name='ticket-detail'),
#     path('tickets/<int:pk>/comments/', TicketViewSet.as_view({'post': 'add_comment'}), name='ticket-comments'),
#     path('tickets/<int:pk>/assign-me/', TicketViewSet.as_view({'post': 'assign_to_me'}), name='ticket-assign-me'),
# ]