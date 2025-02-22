defmodule LiveVideoRemix.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      LiveVideoRemixWeb.Telemetry,
      # LiveVideoRemix.Repo,
      {DNSCluster, query: Application.get_env(:live_video_remix, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: LiveVideoRemix.PubSub},
      # Start the Finch HTTP client for sending emails
      {Finch, name: LiveVideoRemix.Finch},
      # Start a worker by calling: LiveVideoRemix.Worker.start_link(arg)
      # {LiveVideoRemix.Worker, arg},
      # Start to serve requests, typically the last entry
      LiveVideoRemixWeb.Endpoint,
      LiveVideoRemixWeb.Presence,
      LiveVideoRemix.PeerSupervisor,
      LiveVideoRemix.Room,
      {Registry, name: LiveVideoRemix.PeerRegistry, keys: :unique}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: LiveVideoRemix.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    LiveVideoRemixWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
