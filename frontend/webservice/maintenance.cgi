#!/usr/bin/perl -T
#
##----- NDDI OESS maintenance.cgi
##-----
##----- $Id$
##----- $Date$
##----- $LastChangedBy$
##-----
##----- Provides a WebAPI to allow for maintenance of nodes and links
##
##-------------------------------------------------------------------------
##
##
## Copyright 2011 Trustees of Indiana University
##
##   Licensed under the Apache License, Version 2.0 (the "License");
##   you may not use this file except in compliance with the License.
##   You may obtain a copy of the License at
##
##       http://www.apache.org/licenses/LICENSE-2.0
##
##   Unless required by applicable law or agreed to in writing, software
##   distributed under the License is distributed on an "AS IS" BASIS,
##   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
##   See the License for the specific language governing permissions and
##   limitations under the License.
##

use strict;
use warnings;

use CGI;
use Data::Dumper;
use JSON;
use OESS::Database;
use Switch;


my $db = new OESS::Database();
my $cgi = new CGI;

$| = 1;


sub main {
    if (!$db) {
        send_json( { "error" => "Unable to connect to database." } );
        exit(1);
    }
    my $action = $cgi->param('action');
    print STDERR "action " . $action;

    my $user = $db->get_user_by_id(user_id => $db->get_user_id_by_auth_name( auth_name => $ENV{'REMOTE_USER'}))->[0];
    if ($user->{'status'} eq 'decom') {
        $action = "error";
    }

    my $output;
    switch ($action) {
        case "nodes" {
            $output = &node_maintenances();
        }
        case "node_start" {
            $output = &start_node_maintenance();
        }
        case "node_end" {
            $output = &end_node_maintenance();
        }
        case "links" {
            $output = &link_maintenances();
        }
        case "link_start" {
            $output = &start_link_maintenance();
        }
        case "link_end"{
            $output = &end_link_maintenance();
        }
        case "error" {
            my $message = "Decommed users cannot use webservices.";
            warn $message;
            $output = { error => $message };
        } 
        else {
            $output = {
                error => "Unknown action - $action"
            };
        }
    }
    send_json($output);
}

sub send_json {
    my $output = shift;
    print "Content-type: text/plain\n\n" . encode_json($output);
}

sub node_maintenances {
    my $results;
    my $node_id = $cgi->param('node_id');

    my $data;
    if (defined $node_id) {
        $data = $db->get_node_maintenance($node_id);
    } else {
        $data = $db->get_node_maintenances();
    }

    if (!defined $data) {
        return { error => "Failed to retrieve nodes under maintenance." };
    }
    $results->{'results'} = $data;
    return $results;
}

# {
#   "maintenance_id": 117,
#   "node"          : "sdn-sw.alba.net.internet2.edu"
#   "description"   : "What is the matrix?",
#   "start_epoch"   : 123456789,
#   "end_epoch"     : -1
# }
sub start_node_maintenance {
    my $results;
    my $node_id = $cgi->param('node_id');
    my $description = $cgi->param('description');

    if (!defined $node_id) {
        return { error => "Parameter node_id must be provided." };
    }
    
    if (!defined $description) {
        $description = "";
    }

    my $data = $db->start_node_maintenance($node_id, $description);
    if (!defined $data) {
        return { error => "Failed to put node into maintenance mode." };
    }
    $results->{'results'} = $data;
    return $results;
}

sub end_node_maintenance {
    my $results;
    my $node_id = $cgi->param('node_id');
    if (!defined $node_id) {
        return { error => "Parameter node_id must be provided." };
        return $results;
    }
    
    my $data = $db->end_node_maintenance($node_id);
    if (!defined $data) {
        return { error => "Failed to take node out of maintenance mode." };
    }

    $results->{'results'} = $data;
    return $results;
}

sub link_maintenances {
    my $results;
    $results->{'results'} = [];

    my $link_id = $cgi->param('link_id');
    if (!defined $link_id) {
        return { error => "Failed to retrieve links under maintenance." };
    }

    return $results;
}

sub start_link_maintenance {
    my $results;
    $results->{'results'} = {};

    my $link_id = $cgi->param('link_id');
    if (!defined $link_id) {
        return { error => "Parameter link_id must be provided." };
    }

    return $results;
}

sub end_link_maintenance {
    my $results;
    $results->{'results'} = {};

    my $link_id = $cgi->param('link_id');
    if (!defined $link_id) {
        return { error => "Parameter link_id must be provided." };
    }

    return $results;
}

main();
