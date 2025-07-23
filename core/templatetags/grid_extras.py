from django import template
register = template.Library()

@register.filter
def get_item(list_or_tuple, i):
    try:
        return list_or_tuple[i]
    except Exception:
        return '' 