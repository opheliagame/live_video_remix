defmodule LiveVideoRemix.Repo do
  use Ecto.Repo,
    otp_app: :live_video_remix,
    adapter: Ecto.Adapters.Postgres
end
