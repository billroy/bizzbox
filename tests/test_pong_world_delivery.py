"""Pong World must be reachable through the app and fresh after reload."""

from app import create_app
from server.config import AppConfig


def test_pong_world_route_and_client_assets():
    app, _ = create_app(AppConfig())
    client = app.test_client()

    redirect = client.get("/pong-world", follow_redirects=False)
    assert redirect.status_code == 302
    assert redirect.location == "/?scene=Pong%20World"

    page = client.get(redirect.location)
    assert page.status_code == 200
    assert page.cache_control.no_store

    scenes = client.get("/static/js/scenes.js")
    assert scenes.status_code == 200
    assert scenes.cache_control.no_store
    assert b"name: 'Pong World'" in scenes.data


def test_new_activity_scene_routes():
    app, _ = create_app(AppConfig())
    client = app.test_client()

    flyover = client.get("/wireframe-flyover", follow_redirects=False)
    blueprint = client.get("/industrial-blueprint", follow_redirects=False)

    assert flyover.status_code == 302
    assert flyover.location == "/?scene=Wireframe%20Flyover"
    assert blueprint.status_code == 302
    assert blueprint.location == "/?scene=Industrial%20Blueprint"
