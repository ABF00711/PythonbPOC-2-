from django import template

register = template.Library()

@register.filter
def to_dynamic_grid_url(url):
    """
    Transform a URL to the dynamic-grid format if it's not already in that format.
    Examples:
    - '/customers/' -> '/dynamic-grid/customers/'
    - '/dynamic-grid/customers/' -> '/dynamic-grid/customers/' (unchanged)
    - '/about/' -> '/about/' (unchanged)
    """
    if url.startswith('/dynamic-grid/'):
        return url
    elif url.startswith('/') and url.endswith('/') and url not in ['/', '/about/', '/contact/']:
        # Extract the table name (remove leading and trailing slashes)
        table_name = url.strip('/')
        return f'/dynamic-grid/{table_name}/'
    else:
        return url 